/**
 * Sleeper API Service
 *
 * Free, public API for NFL player stats and projections
 * No authentication required!
 *
 * Docs: https://docs.sleeper.com/
 */

import axios from "axios";
import { NormalizedPlayerStats, PlayerWeeklyStats } from "./yahoo-types";

const SLEEPER_BASE_URL = "https://api.sleeper.app/v1";
const CURRENT_SEASON = 2025; // NFL season year

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  team: string | null;
  position: string;
  number: number;
  status: string;
  injury_status: string | null;
  fantasy_positions: string[];
}

interface SleeperStats {
  [playerId: string]: {
    // Passing
    pass_att?: number;
    pass_cmp?: number;
    pass_yd?: number;
    pass_td?: number;
    pass_int?: number;
    pass_2pt?: number;

    // Rushing
    rush_att?: number;
    rush_yd?: number;
    rush_td?: number;
    rush_2pt?: number;

    // Receiving
    rec?: number;
    rec_yd?: number;
    rec_td?: number;
    rec_2pt?: number;

    // Fumbles
    fum?: number;
    fum_lost?: number;

    // Defense/ST
    def_td?: number;
    def_int?: number;
    def_sack?: number;
    def_fr?: number;
    def_ff?: number;
    pts_allow?: number;

    // Kicking
    fgm?: number;
    fgm_0_19?: number;
    fgm_20_29?: number;
    fgm_30_39?: number;
    fgm_40_49?: number;
    fgm_50p?: number;
    fga?: number;
    xpm?: number;
    xpa?: number;
  };
}

interface ScoringSettings {
  // Yahoo stat_id to Sleeper stat mapping
  statMappings: Map<number, string>;
  // Yahoo stat_id to points per unit
  scoringRules: Map<number, number>;
}

export class SleeperService {
  private playersCache: Map<string, SleeperPlayer> | null = null;
  private playersCacheTimestamp = 0;
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Load all NFL players (cached for 24 hours)
   */
  private async getPlayers(): Promise<Map<string, SleeperPlayer>> {
    // Check cache
    if (
      this.playersCache &&
      Date.now() - this.playersCacheTimestamp < this.CACHE_DURATION_MS
    ) {
      return this.playersCache;
    }

    try {
      const response = await axios.get<{ [id: string]: SleeperPlayer }>(
        `${SLEEPER_BASE_URL}/players/nfl`,
        { timeout: 30000 }
      );

      // Convert to Map for easy lookup
      this.playersCache = new Map(Object.entries(response.data));
      this.playersCacheTimestamp = Date.now();

      return this.playersCache;
    } catch (error: any) {
      console.error("[SleeperService] Failed to fetch players:", error.message);
      throw new Error(`Failed to fetch Sleeper players: ${error.message}`);
    }
  }

  /**
   * Find Sleeper player by Yahoo player name
   */
  async findPlayerByName(
    yahooPlayerName: string
  ): Promise<SleeperPlayer | null> {
    const players = await this.getPlayers();

    // Normalize name for comparison
    const normalizedSearch = yahooPlayerName.toLowerCase().trim();

    // Try exact full name match first
    for (const player of players.values()) {
      if (player.full_name?.toLowerCase() === normalizedSearch) {
        return player;
      }
    }

    // Try partial match (handles "Chris Olave" vs "Christopher Olave")
    for (const player of players.values()) {
      const fullName = player.full_name?.toLowerCase() || "";
      if (
        fullName.includes(normalizedSearch) ||
        normalizedSearch.includes(fullName)
      ) {
        return player;
      }
    }

    console.warn(`[SleeperService] Could not find player: ${yahooPlayerName}`);
    return null;
  }

  /**
   * Get stats for a specific week
   */
  async getWeekStats(
    week: number,
    season = CURRENT_SEASON
  ): Promise<SleeperStats> {
    try {
      const response = await axios.get<SleeperStats>(
        `${SLEEPER_BASE_URL}/stats/nfl/regular/${season}/${week}`,
        { timeout: 10000 }
      );

      return response.data;
    } catch (error: any) {
      console.error(
        `[SleeperService] Failed to fetch week ${week} stats:`,
        error.message
      );
      return {}; // Return empty stats on error
    }
  }

  /**
   * Get projections for a specific week
   */
  async getWeekProjections(
    week: number,
    season = CURRENT_SEASON
  ): Promise<SleeperStats> {
    try {
      const response = await axios.get<SleeperStats>(
        `${SLEEPER_BASE_URL}/projections/nfl/regular/${season}/${week}`,
        { timeout: 10000 }
      );

      return response.data;
    } catch (error: any) {
      console.warn(
        `[SleeperService] Failed to fetch week ${week} projections:`,
        error.message
      );
      return {}; // Return empty projections on error
    }
  }

  /**
   * Calculate fantasy points from Sleeper stats using Yahoo scoring settings
   */
  calculateFantasyPoints(
    stats: SleeperStats[string],
    scoringSettings: ScoringSettings
  ): number {
    let totalPoints = 0;

    // Map Yahoo stat IDs to Sleeper stat fields
    const yahooToSleeper: {
      [yahooStatId: number]: keyof SleeperStats[string];
    } = {
      4: "pass_yd", // Passing yards
      5: "pass_td", // Passing TD
      6: "pass_int", // Interceptions
      8: "pass_2pt", // Passing 2pt conversions
      9: "rush_yd", // Rushing yards
      10: "rush_td", // Rushing TD
      11: "rec", // Receptions
      12: "rec_yd", // Receiving yards
      13: "rec_td", // Receiving TD
      15: "rec_2pt", // Receiving 2pt conversions
      16: "rush_2pt", // Rushing 2pt conversions
      18: "fum_lost", // Fumbles lost
    };

    // Calculate points based on scoring rules
    for (const [
      yahooStatId,
      points,
    ] of scoringSettings.scoringRules.entries()) {
      const sleeperStatKey = yahooToSleeper[yahooStatId];
      if (sleeperStatKey && stats[sleeperStatKey] !== undefined) {
        const statValue = stats[sleeperStatKey] || 0;
        totalPoints += statValue * points;
      }
    }

    return totalPoints;
  }

  /**
   * Get full season stats for a player by name
   */
  async getPlayerSeasonStats(
    yahooPlayerName: string,
    startWeek: number,
    endWeek: number,
    scoringSettings: ScoringSettings,
    season = CURRENT_SEASON
  ): Promise<NormalizedPlayerStats | null> {
    // Find player
    const player = await this.findPlayerByName(yahooPlayerName);
    if (!player) {
      return null;
    }

    const weeklyData: PlayerWeeklyStats[] = [];

    // Fetch all weeks in parallel (Sleeper allows this!)
    const weekPromises = [];
    for (let week = startWeek; week <= endWeek; week++) {
      weekPromises.push(
        Promise.all([
          this.getWeekStats(week, season),
          this.getWeekProjections(week, season),
        ]).then(([stats, projections]) => ({
          week,
          stats: stats[player.player_id] || {},
          projections: projections[player.player_id] || {},
        }))
      );
    }

    const weeklyResults = await Promise.all(weekPromises);

    // Process each week
    for (const { week, stats, projections } of weeklyResults) {
      const actualPoints = this.calculateFantasyPoints(stats, scoringSettings);
      const projectedPoints = this.calculateFantasyPoints(
        projections,
        scoringSettings
      );

      weeklyData.push({
        week,
        projectedPoints,
        actualPoints,
        difference: actualPoints - projectedPoints,
        percentDifference:
          projectedPoints > 0
            ? ((actualPoints - projectedPoints) / projectedPoints) * 100
            : 0,
      });
    }

    // Calculate summary stats
    const gamesPlayed = weeklyData.filter((w) => w.actualPoints > 0).length;
    const playedWeeks = weeklyData.filter((w) => w.actualPoints > 0);
    const totalActual = playedWeeks.reduce((sum, w) => sum + w.actualPoints, 0);
    const totalProjected = playedWeeks.reduce(
      (sum, w) => sum + w.projectedPoints,
      0
    );
    const totalDifference = totalActual - totalProjected;
    const averageActual = gamesPlayed > 0 ? totalActual / gamesPlayed : 0;
    const averageProjected = gamesPlayed > 0 ? totalProjected / gamesPlayed : 0;

    // Calculate accuracy rate (weeks within 20% of projection)
    const accurateWeeks = playedWeeks.filter(
      (w) => w.projectedPoints > 0 && Math.abs(w.percentDifference) <= 20
    ).length;
    const accuracyRate =
      gamesPlayed > 0 ? (accurateWeeks / gamesPlayed) * 100 : 0;

    return {
      playerKey: `sleeper.${player.player_id}`,
      playerId: player.player_id,
      name: player.full_name || `${player.first_name} ${player.last_name}`,
      position: player.position,
      team: player.team || "FA",
      weeklyData,
      summary: {
        totalProjected,
        totalActual,
        totalDifference,
        averageProjected,
        averageActual,
        weeksPlayed: gamesPlayed,
        accuracyRate,
      },
    };
  }
}
