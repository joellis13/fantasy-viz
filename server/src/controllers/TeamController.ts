import { Request as ExpressRequest } from "express";
import {
  Controller,
  Get,
  Path,
  Query,
  Route,
  Tags,
  Security,
  SuccessResponse,
  Response,
  Request,
} from "tsoa";
import { PlayerStatsResponse, ErrorResponse } from "../models";
import { FantasyService } from "../FantasyService";
import { getTokenForUserId } from "./LeagueController";

@Route("api/team")
@Tags("Team")
export class TeamController extends Controller {
  private fantasyService = new FantasyService();

  /**
   * Get team roster for a specific week
   * @summary Get team roster
   * @param teamKey Yahoo Fantasy team key (format: league_key.t.team_id, e.g., "423.l.12345.t.1")
   * @param week Week number (1-18), defaults to current week
   * @example teamKey "461.l.329011.t.2"
   * @example week 1
   */
  @Get("{teamKey}/roster")
  @Security("cookieAuth")
  @SuccessResponse("200", "Successfully retrieved team roster")
  @Response<ErrorResponse>("401", "Not authenticated")
  @Response<ErrorResponse>("404", "Team not found")
  @Response<ErrorResponse>("500", "Failed to fetch roster")
  public async getTeamRoster(
    @Request() request: any,
    @Path() teamKey: string,
    @Query() week?: number
  ): Promise<any> {
    const userId = request.user?.userId;
    if (!userId) {
      this.setStatus(401);
      throw new Error("Not authenticated");
    }

    const token = getTokenForUserId(userId);
    if (!token) {
      this.setStatus(401);
      throw new Error("Not authenticated");
    }

    try {
      return await this.fantasyService.getTeamRoster(
        teamKey,
        token.access_token,
        week
      );
    } catch (err: any) {
      console.error("Error fetching roster:", err.message);

      // Set appropriate status codes
      if (err.message.includes("not found") || err.message.includes("404")) {
        this.setStatus(404);
      } else if (err.message.includes("timeout")) {
        this.setStatus(504);
      } else if (err.message.includes("Not authorized")) {
        this.setStatus(401);
      } else {
        this.setStatus(500);
      }

      throw new Error(err.message);
    }
  }

  /**
   * Get player statistics for a team across multiple weeks
   * @summary Get player statistics
   * @param teamKey Yahoo Fantasy team key (format: league_key.t.team_id, e.g., "423.l.12345.t.1")
   * @param startWeek Starting week number (1-18)
   * @param endWeek Ending week number (1-18)
   * @example teamKey "423.l.12345.t.1"
   * @example startWeek 1
   * @example endWeek 17
   */
  @Get("{teamKey}/player-stats")
  @Security("cookieAuth")
  @SuccessResponse("200", "Successfully retrieved player statistics")
  @Response<ErrorResponse>("400", "Invalid week range")
  @Response<ErrorResponse>("401", "Not authenticated")
  @Response<ErrorResponse>("500", "Failed to fetch player statistics")
  public async getPlayerStats(
    @Path() teamKey: string,
    @Query() startWeek: number = 1,
    @Query() endWeek: number = 17,
    @Request() request: any
  ): Promise<PlayerStatsResponse> {
    // Validate week range
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

    const token = getTokenForUserId(userId);
    if (!token) {
      this.setStatus(401);
      throw new Error("Not authenticated");
    }

    try {
      return await this.fantasyService.getPlayerStats(
        teamKey,
        startWeek,
        endWeek,
        token.access_token
      );
    } catch (err: any) {
      console.error(
        "Error fetching player stats:",
        err.response?.data || err.message
      );
      this.setStatus(500);
      throw new Error("Failed to fetch player stats: " + err.message);
    }
  }
}
