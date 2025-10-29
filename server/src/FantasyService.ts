import axios from "axios";
import { normalizeLeague, normalizePlayerComparison } from "./parsers";
import { LeagueResponse, PlayerComparisonResponse } from "./models";
import { NormalizedLeague, NormalizedPlayerComparison } from "./yahoo-types";

export class FantasyService {
  /**
   * Fetch league standings from Yahoo Fantasy API
   */
  async getLeague(
    leagueKey: string,
    accessToken: string
  ): Promise<LeagueResponse> {
    const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${encodeURIComponent(
      leagueKey
    )}/standings?format=json`;

    console.log("Fetching league from Yahoo API:\n", yahooUrl);

    try {
      const resp = await axios.get(yahooUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 10000, // 10 second timeout
      });

      console.log("Raw league data received, normalizing...");
      const normalized = normalizeLeague(resp.data);
      console.log("League data normalized successfully");

      // Convert to API response format
      return this.convertLeagueResponse(normalized, leagueKey);
    } catch (err: any) {
      if (err.code === "ECONNABORTED") {
        throw new Error("Request to Yahoo API timed out");
      }
      if (err.response?.status === 404) {
        throw new Error("League not found. Check your league key.");
      }
      if (err.response?.status === 401) {
        throw new Error("Not authorized. Please reconnect with Yahoo.");
      }
      throw new Error(`Failed to fetch league: ${err.message}`);
    }
  }

  /**
   * Fetch player comparison data across multiple weeks
   */
  async getPlayerComparison(
    teamKey: string,
    startWeek: number,
    endWeek: number,
    accessToken: string
  ): Promise<PlayerComparisonResponse> {
    console.log(
      `Fetching player comparison for team ${teamKey}, weeks ${startWeek}-${endWeek}`
    );

    // Fetch roster data for each week in parallel
    const weeklyPromises: Promise<{ week: number; data: any }>[] = [];

    for (let week = startWeek; week <= endWeek; week++) {
      const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${encodeURIComponent(
        teamKey
      )}/roster;week=${week}?format=json`;

      const promise = axios
        .get(yahooUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .then((resp) => ({ week, data: resp.data }))
        .catch((err) => {
          console.warn(`Failed to fetch week ${week}:`, err.message);
          return { week, data: null };
        });

      weeklyPromises.push(promise);
    }

    // Wait for all requests to complete
    const weeklyResponses = await Promise.all(weeklyPromises);

    // Filter out failed requests
    const validResponses = weeklyResponses.filter((r) => r.data !== null);

    if (validResponses.length === 0) {
      throw new Error("Failed to fetch any roster data");
    }

    console.log(
      `Successfully fetched ${validResponses.length} weeks of roster data`
    );

    // Parse and normalize the data
    const playerComparisons = normalizePlayerComparison(validResponses);

    return this.convertPlayerComparisonResponse(
      teamKey,
      startWeek,
      endWeek,
      validResponses.length,
      playerComparisons
    );
  }

  private convertLeagueResponse(
    normalized: NormalizedLeague,
    leagueKey: string
  ): LeagueResponse {
    return {
      leagueKey,
      name: normalized.name,
      season: new Date().getFullYear(), // You may want to extract this from the league data
      teams: normalized.teams.map((team) => ({
        teamKey: team.id,
        teamName: team.name,
        managerName: "", // Not available in current normalized data
        rank: team.rank,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
        pointsFor: team.seasonTotal,
        pointsAgainst: 0, // Not available in current normalized data
      })),
      points: normalized.points || [], // Include weekly scores for chart
    };
  }

  private convertPlayerComparisonResponse(
    teamKey: string,
    startWeek: number,
    endWeek: number,
    weeksRetrieved: number,
    playerComparisons: NormalizedPlayerComparison[]
  ): PlayerComparisonResponse {
    return {
      teamKey,
      weekRange: { start: startWeek, end: endWeek },
      weeksRetrieved,
      players: playerComparisons.map((player) => ({
        playerKey: player.playerKey,
        playerName: player.name,
        position: player.position,
        team: player.team,
        weeklyData: player.weeklyData.map((week) => ({
          week: week.week,
          projectedPoints: week.projectedPoints,
          actualPoints: week.actualPoints,
          difference: week.difference,
          status: "", // You may want to add status to the parser
        })),
        summary: {
          totalWeeks: player.summary.weeksPlayed,
          avgProjected: player.summary.averageProjected,
          avgActual: player.summary.averageActual,
          accuracyRate: player.summary.accuracyRate,
        },
      })),
      summary: {
        totalPlayers: playerComparisons.length,
        averageAccuracy:
          playerComparisons.length > 0
            ? playerComparisons.reduce(
                (sum, p) => sum + p.summary.accuracyRate,
                0
              ) / playerComparisons.length
            : 0,
      },
    };
  }
}
