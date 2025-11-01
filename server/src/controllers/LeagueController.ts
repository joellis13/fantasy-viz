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
import { LeagueResponse, ErrorResponse } from "../models";
import { FantasyService } from "../FantasyService";
import { getTokenForUserId, setTokenForUserId } from "../tokenStore";

// Re-export for backwards compatibility
export { getTokenForUserId, setTokenForUserId };

@Route("api/league")
@Tags("League")
export class LeagueController extends Controller {
  private fantasyService = new FantasyService();

  /**
   * Get league standings and information
   * @summary Get league standings
   * @param leagueKey Yahoo Fantasy league key (format: game_key.l.league_id, e.g., "423.l.12345")
   * @example leagueKey "423.l.12345"
   */
  @Get("{leagueKey}")
  @Security("cookieAuth")
  @SuccessResponse("200", "Successfully retrieved league data")
  @Response<ErrorResponse>("400", "Invalid league key")
  @Response<ErrorResponse>("401", "Not authenticated")
  @Response<ErrorResponse>("404", "League not found")
  @Response<ErrorResponse>("500", "Failed to fetch league data")
  public async getLeague(
    @Path() leagueKey: string,
    @Request() request: any
  ): Promise<LeagueResponse> {
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
      const result = await this.fantasyService.getLeague(
        leagueKey,
        token.access_token
      );
      return result;
    } catch (err: any) {
      // Set appropriate status codes
      if (err.message.includes("not found") || err.message.includes("404")) {
        this.setStatus(404);
      } else if (err.message.includes("timeout")) {
        this.setStatus(504); // Gateway timeout
      } else if (err.message.includes("Not authorized")) {
        this.setStatus(401);
      } else {
        this.setStatus(500);
      }

      throw new Error(err.message);
    }
  }
}
