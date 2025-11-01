import { Request as ExpressRequest } from "express";
import {
  Controller,
  Get,
  Query,
  Route,
  Tags,
  Security,
  SuccessResponse,
  Response,
  Request,
} from "tsoa";
import {
  PlayerSearchResponse,
  PlayerCompareResponse,
  ErrorResponse,
} from "../models";
import { FantasyService } from "../FantasyService";
import { SleeperService } from "../SleeperService";
import { FantasyPointsCalculator } from "../FantasyPointsCalculator";
import { getTokenForUserId } from "./LeagueController";
import { normalizePlayerSearch, normalizePlayerStats } from "../parsers";
import { NormalizedPlayerStats } from "../yahoo-types";

@Route("api/players")
@Tags("Players")
export class PlayerController extends Controller {
  private fantasyService = new FantasyService();
  private sleeperService = new SleeperService();

  /**
   * Search for players across a game
   * @summary Search players by name or position
   * @param gameKey Game identifier (e.g., "423" for 2024 NFL season)
   * @param search Search query for player name
   * @param position Filter by position (QB, RB, WR, TE, etc.)
   * @param sort Sort field (NAME, OR, AR, PTS, PR)
   * @param start Starting index for pagination (0-based)
   * @param count Number of results to return (max 25)
   * @example gameKey "423"
   * @example search "mahomes"
   * @example position "QB"
   */
  @Get("search")
  @Security("cookieAuth")
  @SuccessResponse("200", "Successfully retrieved players")
  @Response<ErrorResponse>("400", "Invalid parameters")
  @Response<ErrorResponse>("401", "Not authenticated")
  @Response<ErrorResponse>("500", "Failed to search players")
  public async searchPlayers(
    @Request() request: any,
    @Query() gameKey: string,
    @Query() search?: string,
    @Query() position?: string,
    @Query() sort?: string,
    @Query() start: number = 0,
    @Query() count: number = 25
  ): Promise<PlayerSearchResponse> {
    if (!gameKey) {
      this.setStatus(400);
      throw new Error("gameKey is required");
    }

    if (count > 25) {
      this.setStatus(400);
      throw new Error("count cannot exceed 25");
    }

    const userId = request.user?.userId;
    if (!userId) {
      this.setStatus(401);
      throw new Error("Not authenticated");
    }

    const token = await getTokenForUserId(userId);
    if (!token) {
      this.setStatus(401);
      throw new Error("Not authenticated");
    }

    try {
      const rawData = await this.fantasyService.searchPlayers(
        gameKey,
        token.access_token,
        { search, position, sort, start, count }
      );

      return normalizePlayerSearch(rawData, gameKey, start, count);
    } catch (err: any) {
      console.error("Error searching players:", err.message);
      this.setStatus(500);
      throw new Error("Failed to search players: " + err.message);
    }
  }

  /**
   * Compare two or more players across multiple weeks
   * @summary Compare player performance
   * @param playerKeys Comma-separated player keys (e.g., "423.p.33536,423.p.31866")
   * @param teamKey Optional team key for efficient batch fetching (e.g., "423.l.12345.t.1")
   * @param startWeek Starting week number (1-18)
   * @param endWeek Ending week number (1-18)
   * @example playerKeys "423.p.33536,423.p.31866"
   * @example teamKey "423.l.12345.t.1"
   * @example startWeek 1
   * @example endWeek 17
   */
  @Get("compare")
  @Security("cookieAuth")
  @SuccessResponse("200", "Successfully compared players")
  @Response<ErrorResponse>("400", "Invalid parameters")
  @Response<ErrorResponse>("401", "Not authenticated")
  @Response<ErrorResponse>("500", "Failed to compare players")
  public async comparePlayers(
    @Request() request: any,
    @Query() playerKeys: string,
    @Query() teamKey?: string,
    @Query() leagueKey?: string,
    @Query() startWeek: number = 1,
    @Query() endWeek: number = 17
  ): Promise<PlayerCompareResponse> {
    if (!playerKeys) {
      this.setStatus(400);
      throw new Error("playerKeys is required");
    }

    const keys = playerKeys.split(",").map((k) => k.trim());
    if (keys.length < 1) {
      this.setStatus(400);
      throw new Error("At least 1 player key is required");
    }

    if (
      isNaN(startWeek) ||
      isNaN(endWeek) ||
      startWeek < 1 ||
      endWeek > 18 ||
      startWeek > endWeek
    ) {
      this.setStatus(400);
      throw new Error(
        "Invalid week range: startWeek and endWeek must be between 1-18 and startWeek <= endWeek"
      );
    }

    const userId = request.user?.userId;
    if (!userId) {
      this.setStatus(401);
      throw new Error("Not authenticated");
    }

    const token = await getTokenForUserId(userId);
    if (!token) {
      this.setStatus(401);
      throw new Error("Not authenticated");
    }

    try {
      // Extract league key
      const leagueKeyToUse =
        leagueKey || (teamKey ? teamKey.split(".t.")[0] : null);

      if (!leagueKeyToUse) {
        this.setStatus(400);
        throw new Error("leagueKey or teamKey is required");
      }

      // Step 1: Get Yahoo scoring settings
      const scoringRules = await FantasyPointsCalculator.getScoringRules(
        leagueKeyToUse,
        token.access_token
      );

      // Build scoring settings object for Sleeper
      const scoringSettings = {
        statMappings: new Map<number, string>(),
        scoringRules: scoringRules,
      };

      // Step 2: Get player info from Yahoo (to get names) - with caching
      const playerInfoPromises = keys.map(async (playerKey) => {
        const info = await this.fantasyService.getPlayerInfo(
          playerKey,
          token.access_token
        );

        return {
          yahooKey: playerKey,
          name: info?.name || "Unknown Player",
          position: info?.position || "N/A",
        };
      });

      const playerInfos = await Promise.all(playerInfoPromises);

      // Step 3: Get full season stats from Sleeper (in parallel)
      const currentWeek = 8;

      const playersPromises = playerInfos.map(async (info) => {
        try {
          const sleeperStats = await this.sleeperService.getPlayerSeasonStats(
            info.name,
            startWeek,
            endWeek,
            scoringSettings,
            2025, // season
            currentWeek
          );

          if (sleeperStats) {
            // Preserve Yahoo player key for compatibility
            sleeperStats.playerKey = info.yahooKey;
            return sleeperStats;
          } else {
            // Create empty player stats
            return {
              playerKey: info.yahooKey,
              playerId: info.yahooKey.split(".").pop() || "",
              name: info.name,
              position: info.position,
              team: "N/A",
              weeklyData: [],
              summary: {
                totalProjected: 0,
                totalActual: 0,
                totalDifference: 0,
                averageProjected: 0,
                averageActual: 0,
                weeksPlayed: 0,
                accuracyRate: 0,
              },
            };
          }
        } catch (error: any) {
          // Create empty player stats on error
          return {
            playerKey: info.yahooKey,
            playerId: info.yahooKey.split(".").pop() || "",
            name: info.name,
            position: info.position,
            team: "N/A",
            weeklyData: [],
            summary: {
              totalProjected: 0,
              totalActual: 0,
              totalDifference: 0,
              averageProjected: 0,
              averageActual: 0,
              weeksPlayed: 0,
              accuracyRate: 0,
            },
          };
        }
      });

      const players = await Promise.all(playersPromises);

      // Calculate head-to-head comparison
      let player1Better = 0;
      let player2Better = 0;
      let ties = 0;

      if (players.length >= 2) {
        const p1Data = players[0].weeklyData;
        const p2Data = players[1].weeklyData;

        // Match weeks and compare
        for (const week1 of p1Data) {
          const week2 = p2Data.find((w) => w.week === week1.week);
          if (week2) {
            if (week1.actualPoints > week2.actualPoints) {
              player1Better++;
            } else if (week2.actualPoints > week1.actualPoints) {
              player2Better++;
            } else {
              ties++;
            }
          }
        }
      }

      return {
        weekRange: { start: startWeek, end: endWeek },
        players: players.map((p) => ({
          playerKey: p.playerKey,
          name: p.name,
          position: p.position,
          team: p.team,
          weeklyData: p.weeklyData.map((w) => ({
            week: w.week,
            projectedPoints: w.projectedPoints,
            actualPoints: w.actualPoints,
            difference: w.difference,
            status: "",
          })),
          summary: {
            totalWeeks: p.summary.weeksPlayed,
            weeksPlayed: p.summary.weeksPlayed,
            averageProjected: p.summary.averageProjected,
            averageActual: p.summary.averageActual,
            totalProjected: p.summary.totalProjected,
            totalActual: p.summary.totalActual,
            totalDifference: p.summary.totalDifference,
            accuracyRate: p.summary.accuracyRate,
          },
        })),
        comparison: {
          player1Better,
          player2Better,
          ties,
        },
      };
    } catch (err: any) {
      console.error("Error comparing players:", err.message);
      this.setStatus(500);
      throw new Error("Failed to compare players: " + err.message);
    }
  }
}
