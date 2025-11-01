import React, { useEffect, useState } from "react";
import axios from "axios";
import LineChartVisx from "./components/LineChartVisx";
import PlayerStats from "./pages/PlayerStats";

type Point = { week: number; teamName: string; score: number };
type Team = {
  teamKey: string;
  teamName: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
};
type View = "league" | "players";

export default function App() {
  const [view, setView] = useState<View>("league");
  const [leagueKey, setLeagueKey] = useState<string>("461.l.329011");
  const [data, setData] = useState<Point[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamKey, setSelectedTeamKey] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function fetchLeague() {
    if (!leagueKey) {
      alert("Enter a league key (e.g. nfl.l.12345)");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `/api/league/${encodeURIComponent(leagueKey)}`
      );
      setData(res.data.points || []);
      setTeams(res.data.teams || []);
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.error || err.message || "Failed to fetch league"
      );
    } finally {
      setLoading(false);
    }
  }

  function viewTeamPlayers(teamKey: string) {
    setSelectedTeamKey(teamKey);
    setView("players");
  }

  useEffect(() => {
    // optionally load defaults
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          background: "#1f77b4",
          color: "white",
          padding: "16px 20px",
          margin: "-20px -20px 20px -20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>Fantasy Viz</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => setView("league")}
            style={{
              padding: "8px 16px",
              background: view === "league" ? "white" : "transparent",
              color: view === "league" ? "#1f77b4" : "white",
              border: "2px solid white",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            League Standings
          </button>
          <button
            onClick={() => setView("players")}
            style={{
              padding: "8px 16px",
              background: view === "players" ? "white" : "transparent",
              color: view === "players" ? "#1f77b4" : "white",
              border: "2px solid white",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Player Comparison
          </button>
          <a
            href="/auth/yahoo/login"
            style={{
              padding: "8px 16px",
              background: "transparent",
              color: "white",
              border: "2px solid white",
              borderRadius: 4,
              textDecoration: "none",
              fontWeight: "bold",
              display: "inline-block",
            }}
          >
            Connect Yahoo
          </a>
        </div>
      </div>

      {view === "league" ? (
        <>
          <h2>League Standings & Weekly Scores</h2>
          <p>
            View team standings and weekly performance trends across your
            league.
          </p>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              <strong>League Key:</strong>
              <input
                value={leagueKey}
                placeholder="e.g., 461.l.329011"
                onChange={(e) => setLeagueKey(e.target.value)}
                style={{ padding: 8, width: 300, marginLeft: 8 }}
              />
            </label>
            <button
              onClick={fetchLeague}
              style={{ marginTop: 8, padding: "8px 16px" }}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load League"}
            </button>
          </div>

          <div style={{ marginTop: 24 }}>
            <LineChartVisx data={data} />
          </div>

          {/* Team Standings Table */}
          {teams.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3>Team Standings</h3>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: 16,
                }}
              >
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th style={{ padding: 12, textAlign: "left" }}>Rank</th>
                    <th style={{ padding: 12, textAlign: "left" }}>Team</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Record</th>
                    <th style={{ padding: 12, textAlign: "right" }}>
                      Points For
                    </th>
                    <th style={{ padding: 12, textAlign: "center" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr
                      key={team.teamKey}
                      style={{ borderBottom: "1px solid #e0e0e0" }}
                    >
                      <td style={{ padding: 12 }}>{team.rank}</td>
                      <td style={{ padding: 12, fontWeight: "bold" }}>
                        {team.teamName}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        {team.wins}-{team.losses}-{team.ties}
                      </td>
                      <td style={{ padding: 12, textAlign: "right" }}>
                        {team.pointsFor.toFixed(2)}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <button
                          onClick={() => viewTeamPlayers(team.teamKey)}
                          style={{
                            padding: "6px 12px",
                            background: "#1f77b4",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          View Players
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <PlayerStats initialTeamKey={selectedTeamKey} />
      )}
    </div>
  );
}
