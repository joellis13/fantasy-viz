import type {
  LeagueStandingsResponse,
  YahooLeagueInfo,
  YahooStandingsWrapper,
  YahooTeamWrapper,
  YahooTeamInfo,
  YahooLeagueArray,
  NormalizedLeague,
  NormalizedTeam,
  WeeklyTeamScore,
  TeamRosterResponse,
  YahooRosterPlayer,
  YahooPlayerInfo,
  NormalizedPlayerStats,
  PlayerWeeklyStats,
} from "./yahoo-types";
import type { PlayerSearchResponse, PlayerSearchResult } from "./models";

/**
 * Seeded pseudo-random number generator for deterministic testing
 * Uses a simple Linear Congruential Generator (LCG) algorithm
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Type guard to check if a value is a record/object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to validate if data matches LeagueStandingsResponse structure
 */
function isLeagueStandingsResponse(
  data: unknown
): data is LeagueStandingsResponse {
  if (!isRecord(data)) return false;

  const candidate = data as Record<string, unknown>;

  // Check for fantasy_content wrapper
  if (!isRecord(candidate.fantasy_content)) {
    return false;
  }

  const fantasyContent = candidate.fantasy_content;

  // Check for league array with at least 2 elements
  const league = fantasyContent.league;
  if (!Array.isArray(league) || league.length < 2) {
    return false;
  }

  // First element should have league_id (league info)
  if (!isRecord(league[0]) || !league[0].league_id) {
    return false;
  }

  // Second element should have standings
  if (!isRecord(league[1]) || !league[1].standings) {
    return false;
  }

  return true;
}

/**
 * Find the standings wrapper in the league array by scanning for the object
 * that contains a 'standings' property
 */
function findStandingsWrapper(
  leagueArray: YahooLeagueArray
): YahooStandingsWrapper | undefined {
  return leagueArray.find(
    (item): item is YahooStandingsWrapper =>
      isRecord(item) && "standings" in item
  );
}

/**
 * Find the league info in the league array by scanning for the object
 * that contains 'league_id' property
 */
function findLeagueInfo(
  leagueArray: YahooLeagueArray
): YahooLeagueInfo | undefined {
  return leagueArray.find(
    (item): item is YahooLeagueInfo => isRecord(item) && "league_id" in item
  );
}

/**
 * Safely extract team information from the team info array
 */
function extractTeamInfo(teamInfoArray: YahooTeamInfo[]): {
  id: string;
  teamKey: string;
  name: string;
} {
  let teamId = "unknown";
  let teamKey = "unknown";
  let teamName = "Team";

  for (const infoObj of teamInfoArray) {
    if (infoObj?.team_id) teamId = String(infoObj.team_id);
    if (infoObj?.team_key) teamKey = String(infoObj.team_key);
    if (infoObj?.name) teamName = String(infoObj.name);
  }

  return { id: teamId, teamKey, name: teamName };
}

/**
 * Safely parse a numeric value with fallback
 */
function safeParseFloat(value: unknown, fallback: number = 0): number {
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parse an integer value with fallback
 */
function safeParseInt(value: unknown, fallback: number = 0): number {
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse a single team from Yahoo's team wrapper structure
 */
function parseTeam(teamWrapper: YahooTeamWrapper): NormalizedTeam | null {
  if (!teamWrapper?.team || !Array.isArray(teamWrapper.team)) {
    return null;
  }

  const [teamInfoArray, teamPoints, teamStandings] = teamWrapper.team;

  // Validate required structures
  if (!Array.isArray(teamInfoArray)) {
    return null;
  }

  if (!teamPoints?.team_points?.total) {
    return null;
  }

  if (!teamStandings?.team_standings) {
    return null;
  }

  // Extract team info
  const { id, teamKey, name } = extractTeamInfo(teamInfoArray);

  // Parse numeric values safely
  const seasonTotal = safeParseFloat(teamPoints.team_points.total);
  const rank = safeParseInt(teamStandings.team_standings.rank);
  const wins = safeParseInt(teamStandings.team_standings.outcome_totals?.wins);
  const losses = safeParseInt(
    teamStandings.team_standings.outcome_totals?.losses
  );

  // Handle ties - could be string or number
  const tiesRaw = teamStandings.team_standings.outcome_totals?.ties;
  const ties = typeof tiesRaw === "number" ? tiesRaw : safeParseInt(tiesRaw);

  return {
    id,
    teamKey,
    name,
    seasonTotal,
    rank,
    wins,
    losses,
    ties,
  };
}

export function normalizeLeague(
  standingsData: unknown,
  scoreboardData?: unknown | unknown[], // Can be single response or array
  options: { seed?: number; useDeterministicScores?: boolean } = {}
): NormalizedLeague {
  try {
    // Validate the response structure
    if (!isLeagueStandingsResponse(standingsData)) {
      return { id: "unknown", name: "unknown", teams: [], points: [] };
    }

    // Now we have type-safe access to the response
    const leagueArray = standingsData.fantasy_content.league;

    // Extract league info and standings (scanning array to be defensive)
    const leagueInfo = findLeagueInfo(leagueArray);
    const standingsWrapper = findStandingsWrapper(leagueArray);

    if (!leagueInfo) {
      return { id: "unknown", name: "unknown", teams: [], points: [] };
    }

    if (!standingsWrapper) {
      return { id: "unknown", name: "unknown", teams: [], points: [] };
    }

    const leagueId = leagueInfo.league_id || "unknown";
    const leagueName = leagueInfo.name || "Unknown League";
    const endWeek = safeParseInt(leagueInfo.end_week, 17);

    // Extract teams from standings
    const standingsArray = standingsWrapper.standings;
    if (!Array.isArray(standingsArray) || !standingsArray[0]?.teams) {
      return { id: leagueId, name: leagueName, teams: [], points: [] };
    }

    const teamsData = standingsArray[0].teams;
    const teams: NormalizedTeam[] = [];

    // Iterate through numeric keys (Yahoo uses "0", "1", "2", etc. plus "count")
    for (const key in teamsData) {
      if (key === "count") continue;

      const teamWrapper = teamsData[key] as YahooTeamWrapper;
      const team = parseTeam(teamWrapper);

      if (team) {
        teams.push(team);
      }
    }

    // Sort teams by rank to ensure consistent ordering
    teams.sort((a, b) => a.rank - b.rank);

    let points: WeeklyTeamScore[] = [];

    // Try to extract real scores from scoreboard data
    if (scoreboardData) {
      try {
        // Handle both single response and array of responses
        const scoreboardArray = Array.isArray(scoreboardData)
          ? scoreboardData
          : [scoreboardData];

        for (const singleScoreboardData of scoreboardArray) {
          if (!isRecord(singleScoreboardData)) continue;

          const fc = (singleScoreboardData as any).fantasy_content;
          if (!fc?.league || !Array.isArray(fc.league)) continue;

          // Find scoreboard in league array
          const scoreboardWrapper = fc.league.find(
            (item: any) => isRecord(item) && item.scoreboard
          );

          if (!scoreboardWrapper?.scoreboard) continue;

          // Yahoo wraps matchups in a "0" key
          const scoreboardData = scoreboardWrapper.scoreboard["0"];
          if (!scoreboardData?.matchups) continue;

          const matchups = scoreboardData.matchups;

          // Iterate through matchup weeks
          for (const key in matchups) {
            if (key === "count") continue;

            const matchupWrapper = matchups[key]?.matchup;
            if (!matchupWrapper || !isRecord(matchupWrapper)) continue;

            // Week is at the top level of matchup object, not nested
            const week = matchupWrapper.week
              ? safeParseInt(matchupWrapper.week)
              : 1;
            const matchupTeams: any[] = [];

            // matchup is an object with numeric keys for teams, plus metadata like "week", "status", etc
            for (const matchupKey in matchupWrapper) {
              // Skip non-team keys
              if (
                matchupKey === "count" ||
                matchupKey === "week" ||
                matchupKey === "week_start" ||
                matchupKey === "week_end" ||
                matchupKey === "status" ||
                matchupKey === "is_playoffs" ||
                matchupKey === "is_consolation" ||
                matchupKey === "is_matchup_of_the_week" ||
                matchupKey === "is_matchup_recap_available"
              ) {
                continue;
              }

              const item = matchupWrapper[matchupKey];
              if (!isRecord(item)) continue;

              // Check for teams
              if (item.teams && isRecord(item.teams)) {
                // teams is an object with numeric keys
                for (const teamKey in item.teams) {
                  if (teamKey === "count") continue;
                  const teamWrapper = item.teams[teamKey];
                  if (teamWrapper) {
                    matchupTeams.push(teamWrapper);
                  }
                }
              }
            }

            // Extract scores from teams
            for (const teamWrapper of matchupTeams) {
              if (!isRecord(teamWrapper) || !teamWrapper.team) continue;

              const team = teamWrapper.team;
              if (!Array.isArray(team) || team.length < 2) continue;

              // team[0] is an array of team info objects (contains name)
              // team[1] is an object with team_points
              let teamName = "";
              let teamPoints = 0;

              // Extract name from team[0] array
              const teamInfoArray = team[0];
              if (Array.isArray(teamInfoArray)) {
                for (const infoItem of teamInfoArray) {
                  if (isRecord(infoItem) && infoItem.name) {
                    teamName = String(infoItem.name);
                    break;
                  }
                }
              }

              // Extract points from team[1] object
              const teamStatsObj = team[1];
              if (
                isRecord(teamStatsObj) &&
                teamStatsObj.team_points &&
                isRecord(teamStatsObj.team_points)
              ) {
                teamPoints = safeParseFloat(
                  (teamStatsObj.team_points as any).total
                );
              }

              if (teamName && teamPoints > 0) {
                points.push({
                  week,
                  teamName,
                  score: teamPoints,
                });
              }
            }
          }
        }
      } catch (err) {
        points = [];
      }
    }

    // Fallback: generate synthetic scores if scoreboard parsing failed
    if (points.length === 0) {
      const random = options.useDeterministicScores
        ? seededRandom(options.seed ?? 42)
        : Math.random;

      for (let week = 1; week <= endWeek; week++) {
        for (const team of teams) {
          const avgScore =
            team.seasonTotal > 0 ? team.seasonTotal / endWeek : 100;
          const variance = avgScore * 0.3;
          const score = Math.round(avgScore + (random() - 0.5) * variance * 2);

          points.push({
            week,
            teamName: team.name,
            score: Math.max(50, score),
          });
        }
      }
    }

    return {
      id: leagueId,
      name: leagueName,
      teams,
      points,
    };
  } catch (err) {
    console.error("normalizeLeague error:", err);
    if (err instanceof Error) {
      console.error("Error details:", err.message, err.stack);
    }
    return { id: "unknown", name: "unknown", teams: [], points: [] };
  }
}

/**
 * Type guard for team roster response
 */
function isTeamRosterResponse(data: unknown): data is TeamRosterResponse {
  if (!isRecord(data)) return false;

  const candidate = data as Record<string, unknown>;
  if (!isRecord(candidate.fantasy_content)) return false;

  const fantasyContent = candidate.fantasy_content;
  const team = fantasyContent.team;

  if (!Array.isArray(team) || team.length < 2) return false;

  // Check for roster in second element
  const rosterWrapper = team[1];
  if (!isRecord(rosterWrapper) || !rosterWrapper.roster) return false;

  return true;
}

/**
 * Extract player info from the player info array
 */
function extractPlayerInfo(playerInfoArray: YahooPlayerInfo[]): {
  playerKey: string;
  playerId: string;
  name: string;
  position: string;
  team: string;
} {
  let playerKey = "";
  let playerId = "unknown";
  let name = "Unknown Player";
  let position = "UNKNOWN";
  let team = "";

  for (const info of playerInfoArray) {
    if (info?.player_key) playerKey = String(info.player_key);
    if (info?.player_id) playerId = String(info.player_id);
    if (info?.name?.full) name = info.name.full;
    if (info?.display_position) position = info.display_position;
    if (info?.editorial_team_abbr) team = info.editorial_team_abbr;
  }

  return { playerKey, playerId, name, position, team };
}

/**
 * Parse player data from roster response for a single week
 */
function parsePlayerWeekData(playerWrapper: YahooRosterPlayer): {
  playerInfo: ReturnType<typeof extractPlayerInfo>;
  projectedPoints: number;
  actualPoints: number;
} | null {
  if (!playerWrapper?.player || !Array.isArray(playerWrapper.player)) {
    return null;
  }

  const [playerInfoArray, ...rest] = playerWrapper.player;

  if (!Array.isArray(playerInfoArray)) {
    return null;
  }

  const playerInfo = extractPlayerInfo(playerInfoArray);

  // Find projected and actual points in the array
  // Yahoo returns these as additional elements in the player array
  // The rest array typically has: [player_points, player_projected_points, player_stats]
  let projectedPoints = 0;
  let actualPoints = 0;

  for (let i = 0; i < rest.length; i++) {
    const item = rest[i];

    if (isRecord(item)) {
      // Check for player_points (actual points scored)
      if (item.player_points && isRecord(item.player_points)) {
        const pts = safeParseFloat(item.player_points.total);
        actualPoints = pts;
      }

      // Check for player_projected_points (projected points)
      if (
        item.player_projected_points &&
        isRecord(item.player_projected_points)
      ) {
        const pts = safeParseFloat(item.player_projected_points.total);
        projectedPoints = pts;
      }

      // Legacy: Check if it's a player_points structure with coverage_type
      if ("coverage_type" in item && "total" in item) {
        const points = safeParseFloat(item.total);
        const coverageType = item.coverage_type;

        // First YahooPlayerPoints is usually actual points (coverage_type: "week")
        // Second YahooPlayerPoints is usually projected points (coverage_type: "week")
        if (coverageType === "week" && actualPoints === 0) {
          actualPoints = points;
        } else if (coverageType === "week" && actualPoints > 0) {
          // If we already have actual points, this might be projected
          projectedPoints = points;
        }
      }
    }
  }

  // Also check in playerInfoArray elements for player_points and player_projected_points
  for (const info of playerInfoArray) {
    if (info?.player_points?.total) {
      const pts = safeParseFloat(info.player_points.total);
      actualPoints = pts;
    }
    if (info?.player_projected_points?.total) {
      const pts = safeParseFloat(info.player_projected_points.total);
      projectedPoints = pts;
    }
  }

  return {
    playerInfo,
    projectedPoints,
    actualPoints,
  };
}

/**
 * Normalize player stats data from multiple weekly roster responses
 * Takes an array of roster responses (one per week) and combines them into a single stats view
 */
export function normalizePlayerStats(
  weeklyRosterResponses: Array<{ week: number; data: unknown }>
): NormalizedPlayerStats[] {
  const playerMap = new Map<
    string,
    {
      playerKey: string;
      playerId: string;
      name: string;
      position: string;
      team: string;
      weeklyData: PlayerWeeklyStats[];
    }
  >();

  try {
    for (const { week, data } of weeklyRosterResponses) {
      if (!isTeamRosterResponse(data)) {
        continue;
      }

      const team = data.fantasy_content.team;
      const rosterWrapper = team[1];

      if (!isRecord(rosterWrapper) || !rosterWrapper.roster) {
        continue;
      }

      const roster = rosterWrapper.roster as any;

      // Yahoo returns roster as an array-like object with numeric keys
      // We need to find the actual roster data which might be at roster[0] or roster directly
      let players;

      if (roster.players) {
        // Direct access
        players = roster.players;
      } else if (roster[0]?.players) {
        // Nested in array-like structure
        players = roster[0].players;
      } else if (Array.isArray(roster) && roster[0]?.players) {
        // Actually an array
        players = roster[0].players;
      } else {
        continue;
      }

      if (!isRecord(players)) {
        continue;
      }

      // Iterate through player keys
      for (const key in players) {
        if (key === "count") continue;

        const playerWrapper = players[key] as YahooRosterPlayer;
        const parsed = parsePlayerWeekData(playerWrapper);

        if (!parsed) {
          continue;
        }

        const { playerInfo, projectedPoints, actualPoints } = parsed;

        const playerKey =
          playerInfo.playerKey || `player-${playerInfo.playerId}`; // Use player_key if available

        // Initialize player entry if not exists
        if (!playerMap.has(playerKey)) {
          playerMap.set(playerKey, {
            playerKey: playerKey,
            playerId: playerInfo.playerId,
            name: playerInfo.name,
            position: playerInfo.position,
            team: playerInfo.team,
            weeklyData: [],
          });
        }

        const player = playerMap.get(playerKey)!;

        // Calculate difference and percentage
        const difference = actualPoints - projectedPoints;
        const percentDifference =
          projectedPoints > 0
            ? ((actualPoints - projectedPoints) / projectedPoints) * 100
            : 0;

        player.weeklyData.push({
          week,
          projectedPoints,
          actualPoints,
          difference,
          percentDifference,
        });
      }
    }

    // Convert map to array and calculate summaries
    // Filter out players with no weekly data OR players who never actually played
    const result: NormalizedPlayerStats[] = Array.from(playerMap.values())
      .filter(
        (player) =>
          player.weeklyData.length > 0 &&
          player.weeklyData.some((w) => w.actualPoints > 0)
      )
      .map((player) => {
        // Sort weekly data by week
        player.weeklyData.sort((a, b) => a.week - b.week);

        // Yahoo API doesn't consistently provide projected points
        // As a workaround, use the player's running average as "projection"
        // This allows for meaningful comparison of performance
        let runningTotal = 0;
        player.weeklyData.forEach((week, index) => {
          if (week.projectedPoints === 0 && week.actualPoints > 0) {
            // Use running average as projection (or actual for first week)
            if (index === 0) {
              week.projectedPoints = week.actualPoints; // First week, use actual
            } else {
              week.projectedPoints = runningTotal / index; // Running average
            }
            // Recalculate difference with new projection
            week.difference = week.actualPoints - week.projectedPoints;
            week.percentDifference =
              week.projectedPoints > 0
                ? ((week.actualPoints - week.projectedPoints) /
                    week.projectedPoints) *
                  100
                : 0;
          }
          runningTotal += week.actualPoints;
        });

        const totalProjected = player.weeklyData.reduce(
          (sum, w) => sum + w.projectedPoints,
          0
        );
        const totalActual = player.weeklyData.reduce(
          (sum, w) => sum + w.actualPoints,
          0
        );
        const totalDifference = totalActual - totalProjected;
        // Count only weeks where player actually played (had points)
        const weeksPlayed = player.weeklyData.filter(
          (w) => w.actualPoints > 0
        ).length;

        // Calculate accuracy rate (within 20% of projection)
        const accurateWeeks = player.weeklyData.filter(
          (w) => Math.abs(w.percentDifference) <= 20
        ).length;
        const accuracyRate =
          weeksPlayed > 0 ? (accurateWeeks / weeksPlayed) * 100 : 0;

        return {
          ...player,
          summary: {
            totalProjected,
            totalActual,
            totalDifference,
            averageProjected:
              weeksPlayed > 0 ? totalProjected / weeksPlayed : 0,
            averageActual: weeksPlayed > 0 ? totalActual / weeksPlayed : 0,
            totalWeeks: weeksPlayed, // Deprecated field for backwards compatibility
            weeksPlayed,
            accuracyRate,
          },
        };
      });

    // Sort by total actual points (highest first)
    result.sort((a, b) => b.summary.totalActual - a.summary.totalActual);

    return result;
  } catch (err) {
    console.error("normalizePlayerStats error:", err);
    if (err instanceof Error) {
      console.error("Error details:", err.message, err.stack);
    }
    return [];
  }
}

/**
 * Normalize player search results from Yahoo API
 */
export function normalizePlayerSearch(
  data: unknown,
  gameKey: string,
  start: number,
  count: number
): PlayerSearchResponse {
  try {
    if (!isRecord(data) || !isRecord(data.fantasy_content)) {
      throw new Error("Invalid player search response structure");
    }

    const fantasyContent = data.fantasy_content;
    const game = fantasyContent.game;

    if (!Array.isArray(game)) {
      throw new Error("Game data is not an array");
    }

    // Find the players object in the game array
    const playersWrapper = game.find(
      (item) => isRecord(item) && "players" in item
    );

    if (!playersWrapper || !isRecord(playersWrapper.players)) {
      return {
        gameKey,
        totalResults: 0,
        start,
        count,
        players: [],
      };
    }

    const playersData = playersWrapper.players;
    const totalResults = (playersData.count as number) || 0;
    const players: PlayerSearchResult[] = [];

    // Iterate through player keys
    for (const key in playersData) {
      if (key === "count") continue;

      const playerWrapper = playersData[key];
      if (!isRecord(playerWrapper) || !Array.isArray(playerWrapper.player)) {
        continue;
      }

      const playerArray = playerWrapper.player;
      if (playerArray.length === 0) continue;

      const playerInfo = playerArray[0];
      if (!Array.isArray(playerInfo)) continue;

      // Extract player details from the info array
      let playerKey = "";
      let playerId = "";
      let name = "";
      let position = "";
      let team = "";
      let imageUrl = "";
      let status = "";

      for (const info of playerInfo) {
        if (isRecord(info)) {
          if (info.player_key) playerKey = String(info.player_key);
          if (info.player_id) playerId = String(info.player_id);
          if (isRecord(info.name) && info.name.full)
            name = String(info.name.full);
          if (info.display_position) position = String(info.display_position);
          if (info.editorial_team_abbr) team = String(info.editorial_team_abbr);
          if (info.image_url) imageUrl = String(info.image_url);
          if (info.status) status = String(info.status);
        }
      }

      if (playerKey && name) {
        players.push({
          playerKey,
          playerId,
          name,
          position,
          team,
          imageUrl: imageUrl || undefined,
          status: status || undefined,
        });
      }
    }

    return {
      gameKey,
      totalResults,
      start,
      count,
      players,
    };
  } catch (err) {
    console.error("normalizePlayerSearch error:", err);
    return {
      gameKey,
      totalResults: 0,
      start,
      count,
      players: [],
    };
  }
}
