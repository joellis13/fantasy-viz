import type {
  YahooFantasyResponse,
  YahooLeagueInfo,
  YahooStandingsWrapper,
  YahooTeamWrapper,
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
 * Find the standings wrapper in the league array by scanning for the object
 * that contains a 'standings' property, rather than assuming it's at index 1
 */
function findStandingsWrapper(
  leagueArray: any[]
): YahooStandingsWrapper | undefined {
  return leagueArray.find((item) => item?.standings) as
    | YahooStandingsWrapper
    | undefined;
}

/**
 * Find the league info in the league array by scanning for the object
 * that contains 'league_id' property, rather than assuming it's at index 0
 */
function findLeagueInfo(leagueArray: any[]): YahooLeagueInfo | undefined {
  return leagueArray.find((item) => item?.league_id) as
    | YahooLeagueInfo
    | undefined;
}

export function normalizeLeague(
  raw: YahooFantasyResponse | any,
  options: { seed?: number; useDeterministicScores?: boolean } = {}
): NormalizedLeague {
  try {
    // Handle Yahoo's specific structure
    let leagueInfo: YahooLeagueInfo | undefined;
    let standingsWrapper: YahooStandingsWrapper | undefined;

    if (
      raw?.fantasy_content?.league &&
      Array.isArray(raw.fantasy_content.league)
    ) {
      // Standard Yahoo response - scan array for components rather than assuming indices
      const leagueArray = raw.fantasy_content.league;
      leagueInfo = findLeagueInfo(leagueArray);
      standingsWrapper = findStandingsWrapper(leagueArray);

      if (!leagueInfo) {
        console.warn("No league info found in league array");
        return { id: "unknown", name: "unknown", teams: [], points: [] };
      }

      if (!standingsWrapper) {
        console.warn("No standings wrapper found in league array");
        return { id: "unknown", name: "unknown", teams: [], points: [] };
      }
    } else {
      // Fallback for non-standard structure
      console.warn(
        "Non-standard league structure detected - missing fantasy_content.league array"
      );
      return { id: "unknown", name: "unknown", teams: [], points: [] };
    }

    const leagueId = leagueInfo.league_id || "unknown";
    const leagueName = leagueInfo.name || "Unknown League";
    const endWeek = parseInt(String(leagueInfo.end_week), 10) || 17;

    // Extract teams from standings with defensive guards
    const standingsArray = standingsWrapper?.standings;
    if (!standingsArray || !Array.isArray(standingsArray)) {
      console.warn("Invalid standings array structure");
      return { id: leagueId, name: leagueName, teams: [], points: [] };
    }

    const teamsData = standingsArray[0]?.teams;
    if (!teamsData) {
      console.warn("No teams data found in standings");
      return { id: leagueId, name: leagueName, teams: [], points: [] };
    }

    const teams: NormalizedTeam[] = [];

    // Iterate through numeric keys (Yahoo uses "0", "1", "2", etc. plus "count")
    for (const key in teamsData) {
      if (key === "count") continue;

      const teamWrapper = teamsData[key] as YahooTeamWrapper;
      if (
        !teamWrapper ||
        !teamWrapper.team ||
        !Array.isArray(teamWrapper.team)
      ) {
        console.warn(`Skipping malformed team entry at key: ${key}`);
        continue;
      }

      // Defensively destructure with fallbacks
      const [teamInfoArray, teamPoints, teamStandings] = teamWrapper.team;

      // Validate we have the necessary data structures
      if (!Array.isArray(teamInfoArray)) {
        console.warn(`Skipping team at key ${key} - invalid team info array`);
        continue;
      }

      if (!teamPoints?.team_points?.total) {
        console.warn(`Skipping team at key ${key} - missing team_points.total`);
        continue;
      }

      if (!teamStandings?.team_standings) {
        console.warn(`Skipping team at key ${key} - missing team_standings`);
        continue;
      }

      // Find the team_id and name from the info array
      let teamId = "unknown";
      let teamName = "Team";
      for (const infoObj of teamInfoArray) {
        if (infoObj?.team_id) teamId = String(infoObj.team_id);
        if (infoObj?.name) teamName = String(infoObj.name);
      }

      // Parse numeric values with defensive fallbacks
      const seasonTotal = parseFloat(String(teamPoints.team_points.total)) || 0;
      const rank = parseInt(String(teamStandings.team_standings.rank), 10) || 0;
      const wins =
        parseInt(
          String(teamStandings.team_standings.outcome_totals?.wins),
          10
        ) || 0;
      const losses =
        parseInt(
          String(teamStandings.team_standings.outcome_totals?.losses),
          10
        ) || 0;

      // Handle ties - could be string or number
      const tiesRaw = teamStandings.team_standings.outcome_totals?.ties;
      const ties =
        typeof tiesRaw === "number"
          ? tiesRaw
          : parseInt(String(tiesRaw), 10) || 0;

      teams.push({
        id: teamId,
        name: teamName,
        seasonTotal,
        rank,
        wins,
        losses,
        ties,
      });
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
