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
