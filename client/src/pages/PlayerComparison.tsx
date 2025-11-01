import React, { useState } from "react";
import axios from "axios";
import { Group } from "@visx/group";
import { scaleLinear, scalePoint, scaleOrdinal } from "@visx/scale";
import { LinePath, Bar } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { LegendOrdinal } from "@visx/legend";
import { GridRows } from "@visx/grid";

interface PlayerWeeklyComparison {
  week: number;
  projectedPoints: number;
  actualPoints: number;
  difference: number;
  percentDifference: number;
}

interface PlayerSummary {
  totalProjected: number;
  totalActual: number;
  totalDifference: number;
  averageProjected: number;
  averageActual: number;
  weeksPlayed: number;
  accuracyRate: number;
}

interface NormalizedPlayerComparison {
  playerKey: string;
  playerId: string;
  name: string;
  position: string;
  team: string;
  weeklyData: PlayerWeeklyComparison[];
  summary: PlayerSummary;
}

interface PlayerComparisonResponse {
  teamKey: string;
  weekRange: { start: number; end: number };
  weeksRetrieved: number;
  players: NormalizedPlayerComparison[];
  summary: {
    totalPlayers: number;
    averageAccuracy: number;
  };
}

type SortOption = "points" | "difference" | "accuracy" | "name";
type ViewMode = "chart" | "table";

interface PlayerComparisonProps {
  initialTeamKey?: string;
}

export default function PlayerComparison({
  initialTeamKey = "",
}: PlayerComparisonProps) {
  const [teamKey, setTeamKey] = useState<string>(initialTeamKey);
  const [startWeek, setStartWeek] = useState<number>(1);
  const [endWeek, setEndWeek] = useState<number>(17);
  const [data, setData] = useState<PlayerComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("points");
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");

  async function fetchPlayerComparison() {
    if (!teamKey) {
      alert("Enter a team key (e.g. 423.l.123456.t.1)");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get<PlayerComparisonResponse>(
        `/api/team/${encodeURIComponent(teamKey)}/player-comparison`,
        { params: { startWeek, endWeek } }
      );
      setData(res.data);
      // Auto-select first player
      if (res.data.players.length > 0) {
        setSelectedPlayer(res.data.players[0].playerKey);
      }
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.error ||
          err.message ||
          "Failed to fetch player comparison"
      );
    } finally {
      setLoading(false);
    }
  }

  // Get unique positions for filter
  const positions = data
    ? ["ALL", ...Array.from(new Set(data.players.map((p) => p.position)))]
    : ["ALL"];

  // Filter and sort players
  const filteredPlayers = data
    ? data.players.filter(
        (p) => positionFilter === "ALL" || p.position === positionFilter
      )
    : [];

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    switch (sortBy) {
      case "points":
        return b.summary.totalActual - a.summary.totalActual;
      case "difference":
        return b.summary.totalDifference - a.summary.totalDifference;
      case "accuracy":
        return b.summary.accuracyRate - a.summary.accuracyRate;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const selectedPlayerData = sortedPlayers.find(
    (p) => p.playerKey === selectedPlayer
  );

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      <h1>Player Comparison: Projected vs Actual</h1>
      <p>
        Analyze how your players performed vs their projections across the
        season.
      </p>

      {/* Input Controls */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: "#f5f5f5",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            value={teamKey}
            placeholder="Team Key (e.g. 423.l.123456.t.1)"
            onChange={(e) => setTeamKey(e.target.value)}
            style={{ padding: 8, width: 250 }}
          />
          <input
            type="number"
            value={startWeek}
            min={1}
            max={18}
            onChange={(e) => setStartWeek(parseInt(e.target.value) || 1)}
            placeholder="Start Week"
            style={{ padding: 8, width: 100 }}
          />
          <input
            type="number"
            value={endWeek}
            min={1}
            max={18}
            onChange={(e) => setEndWeek(parseInt(e.target.value) || 17)}
            placeholder="End Week"
            style={{ padding: 8, width: 100 }}
          />
          <button
            onClick={fetchPlayerComparison}
            style={{ padding: "8px 16px" }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load Player Data"}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Summary Stats */}
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: "#e8f4f8",
              borderRadius: 8,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Summary</h3>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <strong>Team:</strong> {data.teamKey}
              </div>
              <div>
                <strong>Weeks:</strong> {data.weekRange.start} -{" "}
                {data.weekRange.end}
              </div>
              <div>
                <strong>Players:</strong> {data.summary.totalPlayers}
              </div>
              <div>
                <strong>Avg Accuracy:</strong>{" "}
                {data.summary.averageAccuracy.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* View Controls */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <label>
              <strong>Position:</strong>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                style={{ marginLeft: 8, padding: 6 }}
              >
                {positions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <strong>Sort by:</strong>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{ marginLeft: 8, padding: 6 }}
              >
                <option value="points">Total Points</option>
                <option value="difference">+/- vs Projection</option>
                <option value="accuracy">Accuracy Rate</option>
                <option value="name">Name</option>
              </select>
            </label>

            <label>
              <strong>View:</strong>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                style={{ marginLeft: 8, padding: 6 }}
              >
                <option value="chart">Chart</option>
                <option value="table">Table</option>
              </select>
            </label>
          </div>

          {viewMode === "chart" ? (
            <>
              {/* Player List */}
              <div style={{ marginTop: 20 }}>
                <h3>Select Player ({sortedPlayers.length} players)</h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 8,
                    maxHeight: 300,
                    overflow: "auto",
                    padding: 8,
                    background: "#f9f9f9",
                    borderRadius: 4,
                  }}
                >
                  {sortedPlayers.map((player) => (
                    <button
                      key={player.playerKey}
                      onClick={() => setSelectedPlayer(player.playerKey)}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        background:
                          selectedPlayer === player.playerKey
                            ? "#1f77b4"
                            : "white",
                        color:
                          selectedPlayer === player.playerKey
                            ? "white"
                            : "black",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: "bold" }}>{player.name}</div>
                      <div style={{ fontSize: "0.85em" }}>
                        {player.position} - {player.team}
                      </div>
                      <div style={{ fontSize: "0.8em", marginTop: 4 }}>
                        {player.summary.totalActual.toFixed(1)} pts (
                        {player.summary.totalDifference > 0 ? "+" : ""}
                        {player.summary.totalDifference.toFixed(1)})
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              {selectedPlayerData && (
                <div style={{ marginTop: 24 }}>
                  <h3>{selectedPlayerData.name} - Weekly Performance</h3>
                  <PlayerComparisonChart player={selectedPlayerData} />
                </div>
              )}
            </>
          ) : (
            /* Table View */
            <div style={{ marginTop: 20 }}>
              <h3>Player Statistics ({sortedPlayers.length} players)</h3>
              <div style={{ overflow: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9em",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f0f0f0" }}>
                      <th style={tableCellStyle}>Player</th>
                      <th style={tableCellStyle}>Pos</th>
                      <th style={tableCellStyle}>Team</th>
                      <th style={tableCellStyle}>Weeks</th>
                      <th style={tableCellStyle}>Total Proj</th>
                      <th style={tableCellStyle}>Total Actual</th>
                      <th style={tableCellStyle}>Diff</th>
                      <th style={tableCellStyle}>Avg Proj</th>
                      <th style={tableCellStyle}>Avg Actual</th>
                      <th style={tableCellStyle}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((player) => (
                      <tr
                        key={player.playerKey}
                        style={{
                          borderBottom: "1px solid #e0e0e0",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelectedPlayer(player.playerKey);
                          setViewMode("chart");
                        }}
                      >
                        <td style={tableCellStyle}>{player.name}</td>
                        <td style={tableCellStyle}>{player.position}</td>
                        <td style={tableCellStyle}>{player.team}</td>
                        <td style={tableCellStyle}>
                          {player.summary.weeksPlayed}
                        </td>
                        <td style={tableCellStyle}>
                          {player.summary.totalProjected.toFixed(1)}
                        </td>
                        <td style={tableCellStyle}>
                          {player.summary.totalActual.toFixed(1)}
                        </td>
                        <td
                          style={{
                            ...tableCellStyle,
                            color:
                              player.summary.totalDifference > 0
                                ? "green"
                                : "red",
                            fontWeight: "bold",
                          }}
                        >
                          {player.summary.totalDifference > 0 ? "+" : ""}
                          {player.summary.totalDifference.toFixed(1)}
                        </td>
                        <td style={tableCellStyle}>
                          {player.summary.averageProjected.toFixed(1)}
                        </td>
                        <td style={tableCellStyle}>
                          {player.summary.averageActual.toFixed(1)}
                        </td>
                        <td style={tableCellStyle}>
                          {player.summary.accuracyRate.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const tableCellStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
};

// Chart component for individual player
function PlayerComparisonChart({
  player,
}: {
  player: NormalizedPlayerComparison;
}) {
  const width = 900;
  const height = 400;
  const margin = { top: 20, right: 120, bottom: 50, left: 60 };

  const weeks = player.weeklyData.map((d) => d.week);
  const allPoints = player.weeklyData.flatMap((d) => [
    d.projectedPoints,
    d.actualPoints,
  ]);
  const yMin = Math.max(0, Math.min(...allPoints) - 5);
  const yMax = Math.max(...allPoints) + 5;

  const xScale = scalePoint<number>({
    domain: weeks,
    range: [margin.left, width - margin.right],
    padding: 0.5,
  });

  const yScale = scaleLinear<number>({
    domain: [yMin, yMax],
    range: [height - margin.bottom, margin.top],
    nice: true,
  });

  const colorScale = scaleOrdinal<string, string>({
    domain: ["Projected", "Actual", "Difference"],
    range: ["#ff7f0e", "#2ca02c", "#d62728"],
  });

  return (
    <div style={{ width: "100%", overflow: "auto" }}>
      <svg width={width} height={height}>
        <rect x={0} y={0} width={width} height={height} fill="#fff" rx={6} />
        <Group>
          <GridRows
            scale={yScale}
            width={width - margin.left - margin.right}
            left={margin.left}
            stroke="#e0e0e0"
            strokeOpacity={0.5}
          />
          <AxisLeft scale={yScale} left={margin.left} label="Points" />
          <AxisBottom
            scale={xScale}
            top={height - margin.bottom}
            label="Week"
          />

          {/* Projected line */}
          <LinePath
            data={player.weeklyData}
            x={(d) => xScale(d.week) || 0}
            y={(d) => yScale(d.projectedPoints)}
            stroke={colorScale("Projected")}
            strokeWidth={2}
            strokeDasharray="5,5"
          />

          {/* Actual line */}
          <LinePath
            data={player.weeklyData}
            x={(d) => xScale(d.week) || 0}
            y={(d) => yScale(d.actualPoints)}
            stroke={colorScale("Actual")}
            strokeWidth={3}
          />

          {/* Difference bars */}
          {player.weeklyData.map((d) => {
            const x = xScale(d.week) || 0;
            const y1 = yScale(d.projectedPoints);
            const y2 = yScale(d.actualPoints);
            const barHeight = Math.abs(y2 - y1);
            const barY = Math.min(y1, y2);

            return (
              <Bar
                key={d.week}
                x={x - 3}
                y={barY}
                width={6}
                height={barHeight}
                fill={d.difference > 0 ? "#2ca02c40" : "#d6272840"}
              />
            );
          })}

          {/* Data points */}
          {player.weeklyData.map((d) => (
            <g key={`points-${d.week}`}>
              <circle
                cx={xScale(d.week)}
                cy={yScale(d.projectedPoints)}
                r={4}
                fill={colorScale("Projected")}
              />
              <circle
                cx={xScale(d.week)}
                cy={yScale(d.actualPoints)}
                r={5}
                fill={colorScale("Actual")}
              />
            </g>
          ))}
        </Group>
      </svg>

      {/* Legend */}
      <div style={{ marginTop: 12, display: "flex", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 40,
              height: 3,
              background: colorScale("Projected"),
              borderStyle: "dashed",
            }}
          />
          <span>Projected</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{ width: 40, height: 3, background: colorScale("Actual") }}
          />
          <span>Actual</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              background: "#2ca02c40",
              border: "1px solid #2ca02c",
            }}
          />
          <span>Outperformed</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              background: "#d6272840",
              border: "1px solid #d62728",
            }}
          />
          <span>Underperformed</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div
        className="stats-summary"
        style={{
          marginTop: 20,
          padding: 16,
          background: "#f9f9f9",
          borderRadius: 4,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: "0.85em", color: "#666" }}>
              Total Projected
            </div>
            <div style={{ fontSize: "1.5em", fontWeight: "bold" }}>
              {player.summary.totalProjected.toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.85em", color: "#666" }}>
              Total Actual
            </div>
            <div style={{ fontSize: "1.5em", fontWeight: "bold" }}>
              {player.summary.totalActual.toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.85em", color: "#666" }}>
              Total Difference
            </div>
            <div
              style={{
                fontSize: "1.5em",
                fontWeight: "bold",
                color: player.summary.totalDifference > 0 ? "green" : "red",
              }}
            >
              {player.summary.totalDifference > 0 ? "+" : ""}
              {player.summary.totalDifference.toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.85em", color: "#666" }}>
              Avg Difference
            </div>
            <div
              style={{
                fontSize: "1.5em",
                fontWeight: "bold",
                color: player.summary.totalDifference > 0 ? "green" : "red",
              }}
            >
              {player.summary.totalDifference > 0 ? "+" : ""}
              {(
                player.summary.totalDifference / player.summary.weeksPlayed
              ).toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.85em", color: "#666" }}>
              Accuracy Rate
            </div>
            <div style={{ fontSize: "1.5em", fontWeight: "bold" }}>
              {player.summary.accuracyRate.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
