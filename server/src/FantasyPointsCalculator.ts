/**
 * Fantasy Points Calculator
 *
 * Calculates fantasy points from raw player stats using league scoring settings.
 * This enables calculating points for any player, not just those on the team roster.
 */

import axios from "axios";

interface StatModifier {
  stat: {
    stat_id: number; // Scoring rules use numbers
    value: string;
  };
}

interface PlayerStat {
  stat: {
    stat_id: number | string; // Player stats can be string or number from API
    value: string;
  };
}

interface ScoringCache {
  scoringRules: Map<number, number>;
  timestamp: number;
  leagueKey: string;
}

export class FantasyPointsCalculator {
  private static cache: Map<string, ScoringCache> = new Map();
  private static readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get scoring rules for a league (cached)
   * Public method for use by other services
   */
  public static async getScoringRules(
    leagueKey: string,
    accessToken: string
  ): Promise<Map<number, number>> {
    // Check cache first
    const cached = this.cache.get(leagueKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION_MS) {
      return cached.scoringRules;
    }

    // Fetch from Yahoo API
    const url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${encodeURIComponent(
      leagueKey
    )}/settings?format=json`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      });

      const settings =
        response.data?.fantasy_content?.league?.[1]?.settings?.[0];
      const statModifiers: StatModifier[] = settings?.stat_modifiers?.stats;

      if (!statModifiers) {
        throw new Error("Could not find scoring settings in league data");
      }

      // Build scoring rules map
      const scoringRules = new Map<number, number>();
      for (const modifier of statModifiers) {
        const statId = modifier.stat.stat_id;
        const points = parseFloat(modifier.stat.value);
        if (!isNaN(points)) {
          scoringRules.set(statId, points);
        }
      }

      // Cache the results
      this.cache.set(leagueKey, {
        scoringRules,
        timestamp: Date.now(),
        leagueKey,
      });

      return scoringRules;
    } catch (error: any) {
      console.error(
        `Failed to fetch scoring settings for league ${leagueKey}:`,
        error.message
      );
      throw new Error(
        `Failed to fetch league scoring settings: ${error.message}`
      );
    }
  }

  /**
   * Calculate fantasy points for a player's stats
   */
  static async calculatePoints(
    leagueKey: string,
    playerStats: PlayerStat[],
    accessToken: string
  ): Promise<number> {
    const scoringRules = await this.getScoringRules(leagueKey, accessToken);

    let totalPoints = 0;

    for (const statObj of playerStats) {
      // Convert stat_id to number (API returns it as string for player stats, number for scoring rules)
      const statId =
        typeof statObj.stat.stat_id === "string"
          ? parseInt(statObj.stat.stat_id, 10)
          : statObj.stat.stat_id;
      const statValue = parseFloat(statObj.stat.value);

      if (isNaN(statValue) || isNaN(statId)) continue;

      const pointsPerUnit = scoringRules.get(statId) || 0;
      totalPoints += statValue * pointsPerUnit;
    }

    return totalPoints;
  }

  /**
   * Calculate points for multiple weeks of player stats
   */
  static async calculatePointsForWeeks(
    leagueKey: string,
    weeklyStats: Array<{ week: number; stats: PlayerStat[] }>,
    accessToken: string
  ): Promise<Array<{ week: number; points: number }>> {
    const scoringRules = await this.getScoringRules(leagueKey, accessToken);

    const results: Array<{ week: number; points: number }> = [];

    for (const weekData of weeklyStats) {
      let totalPoints = 0;

      for (const statObj of weekData.stats) {
        // Convert stat_id to number (API returns it as string for player stats, number for scoring rules)
        const statId =
          typeof statObj.stat.stat_id === "string"
            ? parseInt(statObj.stat.stat_id, 10)
            : statObj.stat.stat_id;
        const statValue = parseFloat(statObj.stat.value);

        if (isNaN(statValue) || isNaN(statId)) continue;

        const pointsPerUnit = scoringRules.get(statId) || 0;
        totalPoints += statValue * pointsPerUnit;
      }

      results.push({
        week: weekData.week,
        points: totalPoints,
      });
    }

    return results;
  }

  /**
   * Clear cache for a specific league or all leagues
   */
  static clearCache(leagueKey?: string): void {
    if (leagueKey) {
      this.cache.delete(leagueKey);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache status (for debugging)
   */
  static getCacheStatus(): {
    leagues: string[];
    totalCached: number;
  } {
    return {
      leagues: Array.from(this.cache.keys()),
      totalCached: this.cache.size,
    };
  }
}
