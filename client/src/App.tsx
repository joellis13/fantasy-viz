import React, { useEffect, useState } from "react";
import axios from "axios";
import LineChartVisx from "./components/LineChartVisx";

type Point = { week: number; teamName: string; score: number };

export default function App() {
  const [leagueKey, setLeagueKey] = useState<string>("");
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
      <h1>Fantasy Viz (POC)</h1>
      <p>
        <a href="/auth/yahoo/login">Connect Yahoo Account</a> — backend handles
        OAuth (nfl.l.329011)
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
          style={{ marginLeft: 8 }}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load League"}
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <LineChartVisx data={data} />
      </div>
    </div>
  );
}
