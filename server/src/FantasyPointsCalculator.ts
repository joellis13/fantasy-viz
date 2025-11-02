/**
 * Fantasy Points Calculator
 *
 * Calculates fantasy points from raw player stats using league scoring settings.
 * This enables calculating points for any player, not just those on the team roster.
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";

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
  private static readonly cacheDir = path.join(__dirname, "..", "cache");

  /**
   * Get scoring rules for a league (cached in memory and file)
   * Public method for use by other services
   */
  public static async getScoringRules(
    leagueKey: string,
    accessToken: string
  ): Promise<Map<number, number>> {
    // Check memory cache first
    const cached = this.cache.get(leagueKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION_MS) {
      return cached.scoringRules;
    }

    // Check file cache
    try {
      const filename = `league_${leagueKey.replace(/\./g, "_")}_scoring.json`;
      const filepath = path.join(this.cacheDir, filename);

      if (fs.existsSync(filepath)) {
        const fileCache = JSON.parse(fs.readFileSync(filepath, "utf-8"));

        // Check if file cache is still valid (24 hours)
        if (Date.now() - fileCache.timestamp < this.CACHE_DURATION_MS) {
          // Reconstruct Map from array (JSON can't store Maps directly)
          const scoringRules = new Map<number, number>(fileCache.scoringRules);

          // Load into memory cache
          this.cache.set(leagueKey, {
            scoringRules,
            timestamp: fileCache.timestamp,
            leagueKey,
          });

          return scoringRules;
        }
      }
    } catch (error) {
      // File cache failed, will fetch from API
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

      // Add default 2pt conversion rules if not present (Yahoo often omits these from API)
      // Stat ID 8 = Passing 2pt conversions (2 points)
      // Stat ID 15 = Receiving 2pt conversions (2 points)
      // Stat ID 16 = Rushing 2pt conversions (2 points)
      if (!scoringRules.has(8)) {
        scoringRules.set(8, 2); // Passing 2pt
      }
      if (!scoringRules.has(15)) {
        scoringRules.set(15, 2); // Receiving 2pt
      }
      if (!scoringRules.has(16)) {
        scoringRules.set(16, 2); // Rushing 2pt
      }

      // Cache the results in memory
      this.cache.set(leagueKey, {
        scoringRules,
        timestamp: Date.now(),
        leagueKey,
      });

      // Save to file cache
      try {
        const filename = `league_${leagueKey.replace(/\./g, "_")}_scoring.json`;
        const filepath = path.join(this.cacheDir, filename);

        const cacheData = {
          scoringRules: Array.from(scoringRules.entries()), // Convert Map to array for JSON
          timestamp: Date.now(),
          leagueKey,
        };

        fs.writeFileSync(filepath, JSON.stringify(cacheData, null, 2), "utf-8");
      } catch (error) {
        console.error("Failed to save scoring rules to file cache:", error);
      }

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
