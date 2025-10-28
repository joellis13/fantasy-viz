import React, { useEffect, useState } from "react";
import axios from "axios";
import LineChartVisx from "./components/LineChartVisx";
import PlayerComparison from "./pages/PlayerComparison";

type Point = { week: number; teamName: string; score: number };
type View = "league" | "players";

export default function App() {
  const [view, setView] = useState<View>("league");
  const [leagueKey, setLeagueKey] = useState<string>("461.l.329011");
  const [data, setData] = useState<Point[]>([]);
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
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.error || err.message || "Failed to fetch league"
      );
    } finally {
      setLoading(false);
    }
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
            <input
              value={leagueKey}
              placeholder="leagueKey e.g. nfl.l.12345"
              onChange={(e) => setLeagueKey(e.target.value)}
              style={{ padding: 8, width: 300 }}
            />
            <button
              onClick={fetchLeague}
              style={{ marginLeft: 8, padding: "8px 16px" }}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load League"}
            </button>
          </div>

          <div style={{ marginTop: 24 }}>
            <LineChartVisx data={data} />
          </div>
        </>
      ) : (
        <PlayerComparison />
      )}
    </div>
  );
}
