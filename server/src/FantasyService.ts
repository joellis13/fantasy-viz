import axios from "axios";
import { normalizeLeague, normalizePlayerStats } from "./parsers";
import { LeagueResponse, PlayerStatsResponse } from "./models";
import { NormalizedLeague, NormalizedPlayerStats } from "./yahoo-types";

export class FantasyService {
  // Rate limiting: delay between API calls to avoid Yahoo 999 errors
  private lastRequestTime = 0;
  private readonly minDelayMs = 50; // 50ms between requests = max 20 requests/second

  // Cache for roster data - key: "teamKey:week", value: roster data
  private rosterCache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelayMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minDelayMs - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private getCachedRoster(teamKey: string, week: number): any | null {
    const cacheKey = `${teamKey}:${week}`;
    const cached = this.rosterCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached.data;
    }
    return null;
  }

  private setCachedRoster(teamKey: string, week: number, data: any) {
    const cacheKey = `${teamKey}:${week}`;
    this.rosterCache.set(cacheKey, { data, timestamp: Date.now() });
  }
  /**
   * Fetch league standings from Yahoo Fantasy API
   */
  async getLeague(
    leagueKey: string,
    accessToken: string
  ): Promise<LeagueResponse> {
    try {
      // Fetch standings
      const standingsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${encodeURIComponent(
        leagueKey
      )}/standings?format=json`;

      await this.rateLimit();
      const standingsResp = await axios.get(standingsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      });

      // Fetch scoreboard data week by week (Yahoo doesn't support week ranges)
      const allScoreboardData: any[] = [];

      try {
        // Fetch current week from league info, default to 8
        const currentWeek = 8; // Could extract this from standingsResp if needed
        const weeksToFetch = Array.from(
          { length: currentWeek },
          (_, i) => i + 1
        );

        for (const week of weeksToFetch) {
          const scoreboardUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${encodeURIComponent(
            leagueKey
          )}/scoreboard;week=${week}?format=json`;

          await this.rateLimit();
          const weekResp = await axios.get(scoreboardUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            timeout: 10000,
          });

          allScoreboardData.push(weekResp.data);
        }
      } catch (scoreboardErr: any) {
        // Failed to fetch scoreboard data, will use synthetic scores as fallback
      }

      const normalized = normalizeLeague(standingsResp.data, allScoreboardData);

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
   * Fetch team roster for a specific week
   */
  async getTeamRoster(
    teamKey: string,
    accessToken: string,
    week?: number
  ): Promise<any> {
    const weekParam = week ? `;week=${week}` : "";
    // Add /players/stats to get player points data
    const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${encodeURIComponent(
      teamKey
    )}/roster${weekParam}/players/stats?format=json`;

    try {
      await this.rateLimit();
      const resp = await axios.get(yahooUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      });

      return resp.data;
    } catch (err: any) {
      if (err.code === "ECONNABORTED") {
        throw new Error("Request to Yahoo API timed out");
      }
      if (err.response?.status === 404) {
        throw new Error("Team not found. Check your team key.");
      }
      if (err.response?.status === 401) {
        throw new Error("Not authorized. Please reconnect with Yahoo.");
      }
      throw new Error(`Failed to fetch roster: ${err.message}`);
    }
  }

  /**
   * Fetch player stats across multiple weeks
   */
  async getPlayerStats(
    teamKey: string,
    startWeek: number,
    endWeek: number,
    accessToken: string
  ): Promise<PlayerStatsResponse> {
    // Fetch roster data for each week in parallel
    const weeklyPromises: Promise<{ week: number; data: any }>[] = [];

    for (let week = startWeek; week <= endWeek; week++) {
      // Get roster with stats - Yahoo API doesn't consistently provide projected points
      // in the roster endpoint, so projectedPoints will be 0 for most cases
      const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${encodeURIComponent(
        teamKey
      )}/roster;week=${week}/players/stats?format=json`;

      const promise = axios
        .get(yahooUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .then((resp) => ({ week, data: resp.data }))
        .catch((err) => {
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

    // Parse and normalize the data
    const playerStats = normalizePlayerStats(validResponses);

    return this.convertPlayerStatsResponse(
      teamKey,
      startWeek,
      endWeek,
      validResponses.length,
      playerStats
    );
  }

  /**
   * Search for players across a game
   */
  async searchPlayers(
    gameKey: string,
    accessToken: string,
    options: {
      search?: string;
      position?: string;
      sort?: string;
      start?: number;
      count?: number;
    } = {}
  ): Promise<any> {
    const params = new URLSearchParams({
      format: "json",
      ...Object.fromEntries(
        Object.entries(options).filter(([_, v]) => v !== undefined)
      ),
    });

    const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/game/${encodeURIComponent(
      gameKey
    )}/players?${params.toString()}`;

    try {
      await this.rateLimit();
      const resp = await axios.get(yahooUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      });

      return resp.data;
    } catch (err: any) {
      if (err.code === "ECONNABORTED") {
        throw new Error("Request to Yahoo API timed out");
      }
      if (err.response?.status === 404) {
        throw new Error("Game not found. Check your game key.");
      }
      if (err.response?.status === 401) {
        throw new Error("Not authorized. Please reconnect with Yahoo.");
      }
      throw new Error(`Failed to search players: ${err.message}`);
    }
  }

  /**
   * Fetch stats for specific player across multiple weeks
   */
  async getPlayerStatsByKey(
    playerKey: string,
    startWeek: number,
    endWeek: number,
    accessToken: string
  ): Promise<Array<{ week: number; data: any }>> {
    const weeklyResponses: Array<{ week: number; data: any }> = [];

    // Fetch weeks sequentially with rate limiting to avoid Yahoo 999 errors
    for (let week = startWeek; week <= endWeek; week++) {
      // Use the same format as roster endpoint to get player_points included
      const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/player/${encodeURIComponent(
        playerKey
      )}/stats;type=week;week=${week}?format=json`;

      try {
        await this.rateLimit();
        const resp = await axios.get(yahooUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          timeout: 10000,
        });

        weeklyResponses.push({ week, data: resp.data });
      } catch (err: any) {
        // Continue to next week even if this one fails
      }
    }

    return weeklyResponses;
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
        teamKey: team.teamKey,
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

  private convertPlayerStatsResponse(
    teamKey: string,
    startWeek: number,
    endWeek: number,
    weeksRetrieved: number,
    playerStats: NormalizedPlayerStats[]
  ): PlayerStatsResponse {
    return {
      teamKey,
      weekRange: { start: startWeek, end: endWeek },
      weeksRetrieved,
      players: playerStats.map((player) => ({
        playerKey: player.playerKey,
        name: player.name,
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
          totalWeeks: player.summary.weeksPlayed, // Deprecated: backwards compatibility
          weeksPlayed: player.summary.weeksPlayed,
          averageProjected: player.summary.averageProjected,
          averageActual: player.summary.averageActual,
          totalProjected: player.summary.totalProjected,
          totalActual: player.summary.totalActual,
          totalDifference: player.summary.totalDifference,
          accuracyRate: player.summary.accuracyRate,
        },
      })),
      summary: {
        totalPlayers: playerStats.length,
        averageAccuracy:
          playerStats.length > 0
            ? playerStats.reduce((sum, p) => sum + p.summary.accuracyRate, 0) /
              playerStats.length
            : 0,
      },
    };
  }
}
