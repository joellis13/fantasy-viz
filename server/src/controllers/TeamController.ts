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
import { PlayerComparisonResponse, ErrorResponse } from "../models";
import { FantasyService } from "../FantasyService";
import { getTokenForUserId } from "./LeagueController";

@Route("api/team")
@Tags("Team")
export class TeamController extends Controller {
  private fantasyService = new FantasyService();

  /**
   * Get player comparison data for a team across multiple weeks
   * @summary Get player comparison data
   * @param teamKey Yahoo Fantasy team key (format: league_key.t.team_id, e.g., "423.l.12345.t.1")
   * @param startWeek Starting week number (1-18)
   * @param endWeek Ending week number (1-18)
   * @example teamKey "423.l.12345.t.1"
   * @example startWeek 1
   * @example endWeek 17
   */
  @Get("{teamKey}/player-comparison")
  @Security("cookieAuth")
  @SuccessResponse("200", "Successfully retrieved player comparison data")
  @Response<ErrorResponse>("400", "Invalid week range")
  @Response<ErrorResponse>("401", "Not authenticated")
  @Response<ErrorResponse>("500", "Failed to fetch player comparison data")
  public async getPlayerComparison(
    @Path() teamKey: string,
    @Query() startWeek: number = 1,
    @Query() endWeek: number = 17,
    @Request() request: any
  ): Promise<PlayerComparisonResponse> {
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
      return await this.fantasyService.getPlayerComparison(
        teamKey,
        startWeek,
        endWeek,
        token.access_token
      );
    } catch (err: any) {
      console.error(
        "Error fetching player comparison:",
        err.response?.data || err.message
      );
      this.setStatus(500);
      throw new Error("Failed to fetch player comparison data: " + err.message);
    }
  }
}
