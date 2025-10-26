"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLeague = normalizeLeague;
function normalizeLeague(raw) {
    try {
        // Handle Yahoo's specific structure
        let leagueInfo;
        let standingsWrapper;
        if (raw?.fantasy_content?.league) {
            // Standard Yahoo response
            const leagueArray = raw.fantasy_content.league;
            leagueInfo = leagueArray[0];
            standingsWrapper = leagueArray[1];
        }
        else {
            // Fallback for non-standard structure
            console.warn("Non-standard league structure detected");
            return { id: "unknown", name: "unknown", teams: [], points: [] };
        }
        const leagueId = leagueInfo.league_id;
        const leagueName = leagueInfo.name;
        const endWeek = parseInt(leagueInfo.end_week, 10) || 17;
        // Extract teams from standings
        const teamsData = standingsWrapper.standings[0].teams;
        const teams = [];
        // Iterate through numeric keys (Yahoo uses "0", "1", "2", etc. plus "count")
        for (const key in teamsData) {
            if (key === "count")
                continue;
            const teamWrapper = teamsData[key];
            if (!teamWrapper || !teamWrapper.team)
                continue;
            const [teamInfoArray, teamPoints, teamStandings] = teamWrapper.team;
            // Find the team_id and name from the info array
            let teamId = "unknown";
            let teamName = "Team";
            for (const infoObj of teamInfoArray) {
                if (infoObj.team_id)
                    teamId = infoObj.team_id;
                if (infoObj.name)
                    teamName = infoObj.name;
            }
            const seasonTotal = parseFloat(teamPoints.team_points.total);
            const rank = parseInt(teamStandings.team_standings.rank, 10);
            const wins = parseInt(teamStandings.team_standings.outcome_totals.wins, 10);
            const losses = parseInt(teamStandings.team_standings.outcome_totals.losses, 10);
            const ties = teamStandings.team_standings.outcome_totals.ties;
            teams.push({
                id: teamId,
                name: teamName,
                seasonTotal,
                rank,
                wins,
                losses,
                ties
            });
        }
        // For POC: Yahoo doesn't provide weekly scores in standings endpoint
        // We'll synthesize sample data for visualization
        const points = [];
        for (let week = 1; week <= endWeek; week++) {
            for (const team of teams) {
                // Generate somewhat realistic scores with variance
                const avgScore = team.seasonTotal / endWeek;
                const variance = avgScore * 0.3;
                const score = Math.round(avgScore + (Math.random() - 0.5) * variance * 2);
                points.push({
                    week,
                    teamName: team.name,
                    score: Math.max(50, score) // Ensure minimum score
                });
            }
        }
        return {
            id: leagueId,
            name: leagueName,
            teams,
            points
        };
    }
    catch (err) {
        console.error("normalizeLeague error:", err);
        return { id: "unknown", name: "unknown", teams: [], points: [] };
    }
}
