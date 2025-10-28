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
  NormalizedPlayerComparison,
  PlayerWeeklyComparison,
} from "./yahoo-types";

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
  name: string;
} {
  let teamId = "unknown";
  let teamName = "Team";

  for (const infoObj of teamInfoArray) {
    if (infoObj?.team_id) teamId = String(infoObj.team_id);
    if (infoObj?.name) teamName = String(infoObj.name);
  }

  return { id: teamId, name: teamName };
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
    console.warn("Invalid team info array");
    return null;
  }

  if (!teamPoints?.team_points?.total) {
    console.warn("Missing team_points.total");
    return null;
  }

  if (!teamStandings?.team_standings) {
    console.warn("Missing team_standings");
    return null;
  }

  // Extract team info
  const { id, name } = extractTeamInfo(teamInfoArray);

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
    name,
    seasonTotal,
    rank,
    wins,
    losses,
    ties,
  };
}

export function normalizeLeague(
  raw: unknown,
  options: { seed?: number; useDeterministicScores?: boolean } = {}
): NormalizedLeague {
  try {
    // Validate the response structure
    if (!isLeagueStandingsResponse(raw)) {
      console.warn(
        "Invalid or non-standard league standings response structure"
      );
      return { id: "unknown", name: "unknown", teams: [], points: [] };
    }

    // Now we have type-safe access to the response
    const leagueArray = raw.fantasy_content.league;

    // Extract league info and standings (scanning array to be defensive)
    const leagueInfo = findLeagueInfo(leagueArray);
    const standingsWrapper = findStandingsWrapper(leagueArray);

    if (!leagueInfo) {
      console.warn("No league info found in league array");
      return { id: "unknown", name: "unknown", teams: [], points: [] };
    }

    if (!standingsWrapper) {
      console.warn("No standings wrapper found in league array");
      return { id: "unknown", name: "unknown", teams: [], points: [] };
    }

    const leagueId = leagueInfo.league_id || "unknown";
    const leagueName = leagueInfo.name || "Unknown League";
    const endWeek = safeParseInt(leagueInfo.end_week, 17);

    // Extract teams from standings
    const standingsArray = standingsWrapper.standings;
    if (!Array.isArray(standingsArray) || !standingsArray[0]?.teams) {
      console.warn("Invalid standings array structure");
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
      } else {
        console.warn(`Skipping malformed team entry at key: ${key}`);
      }
    }

    // Sort teams by rank to ensure consistent ordering
    teams.sort((a, b) => a.rank - b.rank);

    // For POC: Yahoo doesn't provide weekly scores in standings endpoint
    // We'll synthesize sample data for visualization
    // Use deterministic seed if provided for reproducible tests
    const random = options.useDeterministicScores
      ? seededRandom(options.seed ?? 42)
      : Math.random;

    const points: WeeklyTeamScore[] = [];
    for (let week = 1; week <= endWeek; week++) {
      for (const team of teams) {
        // Generate somewhat realistic scores with variance
        const avgScore =
          team.seasonTotal > 0 ? team.seasonTotal / endWeek : 100;
        const variance = avgScore * 0.3;
        const score = Math.round(avgScore + (random() - 0.5) * variance * 2);

        points.push({
          week,
          teamName: team.name,
          score: Math.max(50, score), // Ensure minimum score
        });
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
  playerId: string;
  name: string;
  position: string;
  team: string;
} {
  let playerId = "unknown";
  let name = "Unknown Player";
  let position = "UNKNOWN";
  let team = "";

  for (const info of playerInfoArray) {
    if (info?.player_id) playerId = String(info.player_id);
    if (info?.name?.full) name = info.name.full;
    if (info?.display_position) position = info.display_position;
    if (info?.editorial_team_abbr) team = info.editorial_team_abbr;
  }

  return { playerId, name, position, team };
}

/**
 * Parse player data from roster response for a single week
 */
function parsePlayerWeekData(
  playerWrapper: YahooRosterPlayer
): {
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
  let projectedPoints = 0;
  let actualPoints = 0;

  for (const item of rest) {
    if (isRecord(item) && "coverage_type" in item && "total" in item) {
      const points = safeParseFloat(item.total);
      // Projected points don't have an actual week value in some responses
      // We need to check both player_points and player_projected_points
      if (item.coverage_type === "week") {
        actualPoints = points;
      }
    }
  }

  // Also check in playerInfoArray elements for player_points and player_projected_points
  for (const info of playerInfoArray) {
    if (info?.player_points?.total) {
      actualPoints = safeParseFloat(info.player_points.total);
    }
    if (info?.player_projected_points?.total) {
      projectedPoints = safeParseFloat(info.player_projected_points.total);
    }
  }

  return {
    playerInfo,
    projectedPoints,
    actualPoints,
  };
}

/**
 * Normalize player comparison data from multiple weekly roster responses
 * Takes an array of roster responses (one per week) and combines them into a single comparison
 */
export function normalizePlayerComparison(
  weeklyRosterResponses: Array<{ week: number; data: unknown }>
): NormalizedPlayerComparison[] {
  const playerMap = new Map<
    string,
    {
      playerKey: string;
      playerId: string;
      name: string;
      position: string;
      team: string;
      weeklyData: PlayerWeeklyComparison[];
    }
  >();

  try {
    for (const { week, data } of weeklyRosterResponses) {
      if (!isTeamRosterResponse(data)) {
        console.warn(`Invalid roster response for week ${week}`);
        continue;
      }

      const team = data.fantasy_content.team;
      const rosterWrapper = team[1];

      if (!isRecord(rosterWrapper) || !rosterWrapper.roster) {
        console.warn(`No roster found for week ${week}`);
        continue;
      }

      const roster = rosterWrapper.roster as any;
      const players = roster.players;

      if (!isRecord(players)) {
        console.warn(`Invalid players data for week ${week}`);
        continue;
      }

      // Iterate through player keys
      for (const key in players) {
        if (key === "count") continue;

        const playerWrapper = players[key] as YahooRosterPlayer;
        const parsed = parsePlayerWeekData(playerWrapper);

        if (!parsed) continue;

        const { playerInfo, projectedPoints, actualPoints } = parsed;
        const playerKey = `${playerInfo.playerId}`; // Use player ID as key

        // Initialize player entry if not exists
        if (!playerMap.has(playerKey)) {
          playerMap.set(playerKey, {
            playerKey: `player-${playerInfo.playerId}`,
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
    const result: NormalizedPlayerComparison[] = Array.from(
      playerMap.values()
    ).map((player) => {
      // Sort weekly data by week
      player.weeklyData.sort((a, b) => a.week - b.week);

      const totalProjected = player.weeklyData.reduce(
        (sum, w) => sum + w.projectedPoints,
        0
      );
      const totalActual = player.weeklyData.reduce(
        (sum, w) => sum + w.actualPoints,
        0
      );
      const totalDifference = totalActual - totalProjected;
      const weeksPlayed = player.weeklyData.length;

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
          averageProjected: weeksPlayed > 0 ? totalProjected / weeksPlayed : 0,
          averageActual: weeksPlayed > 0 ? totalActual / weeksPlayed : 0,
          weeksPlayed,
          accuracyRate,
        },
      };
    });

    // Sort by total actual points (highest first)
    result.sort((a, b) => b.summary.totalActual - a.summary.totalActual);

    return result;
  } catch (err) {
    console.error("normalizePlayerComparison error:", err);
    if (err instanceof Error) {
      console.error("Error details:", err.message, err.stack);
    }
    return [];
  }
}
