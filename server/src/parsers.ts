export function normalizeLeague(raw: any) {
  try {
    const leagueNode = raw?.fantasy_content?.league || raw?.league || raw;
    const leagueName = leagueNode?.name || leagueNode?.league_name || "league";
    const leagueId = leagueNode?.league_id || leagueNode?.league_key || leagueNode?.id || "unknown";

    // Yahoo standings structure can be nested. Try common paths.
    const teamsRaw =
      leagueNode?.standings?.teams?.team ||
      leagueNode?.standings?.team ||
      leagueNode?.teams?.team ||
      leagueNode?.teams ||
      [];

    const teams = Array.isArray(teamsRaw)
      ? teamsRaw.map((t: any) => ({
          id: t?.team_id || t?.team_key || t?.id,
          name:
            t?.name ||
            t?.nickname ||
            t?.team_name ||
            (t?.managers?.manager?.nickname ?? "Team")
        }))
      : [];

    // For POC: if Yahoo doesn't provide weekly scores, synthesize sample points
    const points: { week: number; teamName: string; score: number }[] = [];
    const weeks = 17;
    for (let w = 1; w <= weeks; w++) {
      for (const t of teams) {
        points.push({
          week: w,
          teamName: t.name,
          score: Math.round(60 + Math.random() * 80)
        });
      }
    }

    return {
      id: leagueId,
      name: leagueName,
      teams,
      points
    };
  } catch (err) {
    console.error("normalizeLeague error:", err);
    return { id: "unknown", name: "unknown", teams: [], points: [] };
  }
}