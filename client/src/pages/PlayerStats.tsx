import React, { useState } from "react";
import axios from "axios";
import { Group } from "@visx/group";
import { scaleLinear, scalePoint, scaleOrdinal } from "@visx/scale";
import { LinePath, Bar } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { LegendOrdinal } from "@visx/legend";
import { GridRows } from "@visx/grid";
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip";
import { localPoint } from "@visx/event";

interface PlayerWeeklyStats {
  week: number;
  projectedPoints: number;
  actualPoints: number;
  difference: number;
  percentDifference: number;
  breakdown?: Array<{ stat: string; value: number; points: number }>;
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

interface NormalizedPlayerStats {
  playerKey: string;
  playerId?: string;
  name: string;
  position: string;
  team: string;
  weeklyData: PlayerWeeklyStats[];
  summary: PlayerSummary;
}

interface PlayerSearchResult {
  playerKey: string;
  playerId: string;
  name: string;
  position: string;
  team: string;
  imageUrl?: string;
  status?: string;
}

interface PlayerStatsResponse {
  weekRange: { start: number; end: number };
  players: NormalizedPlayerStats[];
  comparison: {
    player1Better: number;
    player2Better: number;
    ties: number;
  };
}

interface PlayerSearchResponse {
  gameKey: string;
  totalResults: number;
  start: number;
  count: number;
  players: PlayerSearchResult[];
}

type SortOption = "points" | "difference" | "accuracy" | "name";
type ViewMode = "chart" | "table";

interface PlayerStatsProps {
  initialTeamKey?: string;
}

export default function PlayerStats({ initialTeamKey = "" }: PlayerStatsProps) {
  const [gameKey, setGameKey] = useState<string>("423"); // Default to 2024 NFL
  const [teamKey, setTeamKey] = useState<string>(initialTeamKey);
  const [leagueKey, setLeagueKey] = useState<string>(""); // League key for scoring calculation
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayerKeys, setSelectedPlayerKeys] = useState<string[]>([]);
  const [newlySelectedKeys, setNewlySelectedKeys] = useState<string[]>([]); // Track search selections
  const [startWeek, setStartWeek] = useState<number>(1);
  const [endWeek, setEndWeek] = useState<number>(17);
  const [data, setData] = useState<PlayerStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("points");
  const [viewMode, setViewMode] = useState<ViewMode>("chart");

  // Auto-load team players on mount if teamKey provided
  React.useEffect(() => {
    if (initialTeamKey) {
      loadTeamPlayers();
    }
  }, [initialTeamKey]);

  async function loadTeamPlayers() {
    if (!teamKey) return;

    setLoading(true);
    try {
      // Extract league key from team key (format: 461.l.329011.t.2 -> 461.l.329011)
      const extractedLeagueKey = teamKey.split(".t.")[0];
      setLeagueKey(extractedLeagueKey);

      // Get team roster for week 1 just to extract player keys
      // We'll use the roster endpoint directly to avoid the league standings call
      const rosterRes = await axios.get(
        `/api/team/${encodeURIComponent(teamKey)}/roster`,
        { params: { week: 1 } }
      );

      // Parse Yahoo's roster response structure
      // Structure: fantasy_content.team[1].roster[0].players
      const fantasyContent = rosterRes.data?.fantasy_content;
      if (!fantasyContent?.team) {
        alert("Invalid roster response");
        setLoading(false);
        return;
      }

      const team = fantasyContent.team;
      const rosterWrapper = team[1]; // Team array has [info, roster]
      const roster = rosterWrapper?.roster;

      if (!roster || !roster[0]?.players) {
        alert("No roster found for this team");
        setLoading(false);
        return;
      }

      const playersObj = roster[0].players;
      const playerKeys: string[] = [];

      // Players are stored as numeric keys (0, 1, 2, etc.)
      for (const key in playersObj) {
        if (key === "count") continue; // Skip the count property
        const playerWrapper = playersObj[key];
        if (playerWrapper?.player && Array.isArray(playerWrapper.player)) {
          const playerInfo = playerWrapper.player[0];
          if (Array.isArray(playerInfo)) {
            // Find player_key in the array
            const playerKeyObj = playerInfo.find(
              (item: any) => item.player_key
            );
            if (playerKeyObj?.player_key) {
              playerKeys.push(playerKeyObj.player_key);
            }
          }
        }
      }

      if (playerKeys.length === 0) {
        alert("No players found on this team");
        setLoading(false);
        return;
      }

      // Now get full season data using player compare endpoint with teamKey (efficient!)
      const res = await axios.get<PlayerStatsResponse>("/api/players/compare", {
        params: {
          playerKeys: playerKeys.join(","),
          teamKey, // Pass teamKey to use efficient roster-based fetching
          startWeek,
          endWeek,
        },
      });

      setData(res.data);
      setSelectedPlayerKeys(playerKeys);
      setNewlySelectedKeys([]); // Clear search selections

      // Auto-select first player
      if (res.data.players.length > 0) {
        setSelectedPlayer(res.data.players[0].playerKey);
      }
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.error ||
          err.message ||
          "Failed to fetch team players"
      );
    } finally {
      setLoading(false);
    }
  }

  async function searchPlayers() {
    if (!searchQuery && !positionFilter) {
      alert("Enter a player name or select a position to search");
      return;
    }
    setSearching(true);
    try {
      const params: any = { gameKey };
      if (searchQuery) params.search = searchQuery;
      if (positionFilter) params.position = positionFilter;
      params.count = 25; // Max allowed by Yahoo API

      const res = await axios.get<PlayerSearchResponse>("/api/players/search", {
        params,
      });

      // Skip fetching stats for search results since individual player endpoint
      // doesn't return calculated points. Users can add players to comparison
      // which will use the compare endpoint to get stats.
      setSearchResults(res.data.players);
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.error || err.message || "Failed to search players"
      );
    } finally {
      setSearching(false);
    }
  }

  function togglePlayerSelection(playerKey: string) {
    if (newlySelectedKeys.includes(playerKey)) {
      setNewlySelectedKeys(newlySelectedKeys.filter((k) => k !== playerKey));
    } else {
      setNewlySelectedKeys([...newlySelectedKeys, playerKey]);
    }
  }

  async function fetchPlayerStats() {
    const keysToFetch = data ? newlySelectedKeys : selectedPlayerKeys;

    if (keysToFetch.length === 0) {
      alert("Select at least one player to analyze");
      return;
    }

    // Ensure we have a league key for calculating points
    if (!leagueKey) {
      alert("League key is required. Please load your team roster first.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get<PlayerStatsResponse>("/api/players/compare", {
        params: {
          playerKeys: keysToFetch.join(","),
          teamKey, // Use teamKey to get roster-based stats with points
          leagueKey, // Pass leagueKey for calculating points for searched players
          startWeek,
          endWeek,
        },
      });

      // If we already have data, merge new players
      if (data) {
        const existingKeys = new Set(data.players.map((p) => p.playerKey));
        const newPlayers = res.data.players.filter(
          (p) => !existingKeys.has(p.playerKey)
        );

        setData({
          ...res.data,
          players: [...data.players, ...newPlayers],
        });

        // Update selectedPlayerKeys to include new additions
        setSelectedPlayerKeys([...selectedPlayerKeys, ...newlySelectedKeys]);
      } else {
        setData(res.data);
        setSelectedPlayerKeys(keysToFetch);
      }

      // Clear search selections after adding
      setNewlySelectedKeys([]);
      setSearchResults([]);
      setSearchQuery("");

      // Auto-select first player if none selected
      if (!selectedPlayer && res.data.players.length > 0) {
        setSelectedPlayer(res.data.players[0].playerKey);
      }
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.error ||
          err.message ||
          "Failed to fetch player stats"
      );
    } finally {
      setLoading(false);
    }
  }

  // Sort players (no filtering needed, show all selected players)
  const sortedPlayers = data
    ? [...data.players].sort((a, b) => {
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
      })
    : [];

  const selectedPlayerData = sortedPlayers.find(
    (p) => p.playerKey === selectedPlayer
  );

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      <h1>Player Stats: Projected vs Actual</h1>
      {initialTeamKey && data ? (
        <p>
          Loaded {data.players.length} players from team {teamKey}. Use search
          below to add more players for comparison.
        </p>
      ) : (
        <p>
          Search for players and analyze their full season performance vs
          projections.
        </p>
      )}

      {/* Search Controls */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: "#f5f5f5",
          borderRadius: 8,
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {initialTeamKey && data
            ? "Add More Players (Optional)"
            : "Step 1: Search for Players"}
        </h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="text"
            value={gameKey}
            placeholder="Game Key (e.g. 423 for 2024 NFL)"
            onChange={(e) => setGameKey(e.target.value)}
            style={{ padding: 8, width: 200 }}
            disabled={searching || loading}
          />
          <input
            type="text"
            value={searchQuery}
            placeholder="Player name (e.g. Mahomes)"
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !searching && !loading) {
                searchPlayers();
              }
            }}
            style={{ padding: 8, width: 250 }}
            disabled={searching || loading}
            autoComplete="off"
          />
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            style={{ padding: 8 }}
            disabled={searching || loading}
          >
            <option value="">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="K">K</option>
            <option value="DEF">DEF</option>
          </select>
          <button
            onClick={searchPlayers}
            style={{ padding: "8px 16px" }}
            disabled={searching}
          >
            {searching ? "Searching..." : "Search Players"}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4>Search Results ({newlySelectedKeys.length} selected)</h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                gap: 8,
                maxHeight: 300,
                overflow: "auto",
                padding: 8,
                background: "white",
                borderRadius: 4,
              }}
            >
              {searchResults.map((player) => (
                <div
                  key={player.playerKey}
                  onClick={() => togglePlayerSelection(player.playerKey)}
                  style={{
                    padding: "8px 12px",
                    background: newlySelectedKeys.includes(player.playerKey)
                      ? "#1f77b4"
                      : "#f9f9f9",
                    color: newlySelectedKeys.includes(player.playerKey)
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
                  {player.status && (
                    <div style={{ fontSize: "0.8em", marginTop: 4 }}>
                      Status: {player.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Controls */}
      {(!data && selectedPlayerKeys.length > 0) ||
      (data && newlySelectedKeys.length > 0) ||
      data ? (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "#e8f4f8",
            borderRadius: 8,
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {!data && newlySelectedKeys.length > 0
              ? `Step 2: Analyze Selected Players (${newlySelectedKeys.length})`
              : data && newlySelectedKeys.length > 0
              ? `Add ${newlySelectedKeys.length} More Players`
              : "Analysis Settings"}
          </h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
            {(!data || newlySelectedKeys.length > 0) && (
              <button
                onClick={fetchPlayerStats}
                style={{ padding: "8px 16px" }}
                disabled={loading}
              >
                {loading
                  ? "Loading..."
                  : !data
                  ? "Analyze Players"
                  : "Add Selected Players"}
              </button>
            )}
            {data && initialTeamKey && newlySelectedKeys.length === 0 && (
              <button
                onClick={loadTeamPlayers}
                style={{ padding: "8px 16px" }}
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh Team Data"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {data && (
        <>
          {/* Summary Stats */}
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: "#d4edda",
              borderRadius: 8,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Analysis Results</h3>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <strong>Weeks:</strong> {data.weekRange.start} -{" "}
                {data.weekRange.end}
              </div>
              <div>
                <strong>Players Analyzed:</strong> {data.players.length}
              </div>
              {data.players.length === 2 && (
                <>
                  <div>
                    <strong>Head-to-Head:</strong>{" "}
                    {data.players[0].name.split(" ").pop()}{" "}
                    {data.comparison.player1Better} -{" "}
                    {data.comparison.player2Better}{" "}
                    {data.players[1].name.split(" ").pop()}
                  </div>
                  {data.comparison.ties > 0 && (
                    <div>
                      <strong>Ties:</strong> {data.comparison.ties}
                    </div>
                  )}
                </>
              )}
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
                  <PlayerStatsChart player={selectedPlayerData} />
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
function PlayerStatsChart({ player }: { player: NormalizedPlayerStats }) {
  const width = 900;
  const height = 400;
  const margin = { top: 20, right: 120, bottom: 50, left: 60 };

  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
  } = useTooltip<{
    week: number;
    projected: number;
    actual: number;
    difference: number;
    breakdown?: Array<{ stat: string; value: number; points: number }>;
  }>();

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

  const handleTooltip = (event: React.MouseEvent<SVGCircleElement>, d: any) => {
    const svgElement = (event.target as SVGElement).ownerSVGElement;
    if (svgElement) {
      const coords = localPoint(svgElement, event);
      if (coords) {
        showTooltip({
          tooltipData: {
            week: d.week,
            projected: d.projectedPoints,
            actual: d.actualPoints,
            difference: d.difference,
            breakdown: d.breakdown, // Include breakdown data
          },
          tooltipLeft: coords.x,
          tooltipTop: coords.y,
        });
      }
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", overflow: "auto" }}>
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
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => handleTooltip(e as any, d)}
                onMouseLeave={hideTooltip}
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
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => handleTooltip(e, d)}
                onMouseLeave={hideTooltip}
              />
              <circle
                cx={xScale(d.week)}
                cy={yScale(d.actualPoints)}
                r={5}
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => handleTooltip(e, d)}
                onMouseLeave={hideTooltip}
                fill={colorScale("Actual")}
              />
            </g>
          ))}
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "8px 12px",
            fontSize: "14px",
            zIndex: 1000,
            pointerEvents: "none",
            maxWidth: "300px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>
            Week {tooltipData.week}
          </div>
          <div>Projected: {tooltipData.projected.toFixed(2)} pts</div>
          <div>Actual: {tooltipData.actual.toFixed(2)} pts</div>
          <div
            style={{
              color: tooltipData.difference > 0 ? "#4ade80" : "#f87171",
              fontWeight: "bold",
            }}
          >
            Difference: {tooltipData.difference > 0 ? "+" : ""}
            {tooltipData.difference.toFixed(2)}
          </div>

          {/* Show breakdown for actual points if available */}
          {tooltipData.breakdown && tooltipData.breakdown.length > 0 && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              <div style={{ fontSize: "12px", marginBottom: 4, opacity: 0.8 }}>
                Breakdown:
              </div>
              {tooltipData.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ opacity: 0.8 }}>
                    {item.stat}: {item.value}
                  </span>
                  <span>{item.points.toFixed(2)} pts</span>
                </div>
              ))}
            </div>
          )}
        </TooltipWithBounds>
      )}

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
        {(() => {
          // Calculate stats from only past weeks (where we have actual data)
          const pastWeeks = player.weeklyData.filter((w) => w.actualPoints > 0);
          const totalProjected = pastWeeks.reduce(
            (sum, w) => sum + w.projectedPoints,
            0
          );
          const totalActual = pastWeeks.reduce(
            (sum, w) => sum + w.actualPoints,
            0
          );
          const totalDifference = totalActual - totalProjected;
          const avgDifference =
            pastWeeks.length > 0 ? totalDifference / pastWeeks.length : 0;

          // Calculate accuracy rate (how close projections were on average)
          const avgPercentError =
            pastWeeks.length > 0
              ? pastWeeks.reduce((sum, w) => {
                  const percentError =
                    w.projectedPoints > 0
                      ? Math.abs(w.difference) / w.projectedPoints
                      : 0;
                  return sum + percentError;
                }, 0) / pastWeeks.length
              : 0;
          const accuracyRate = (1 - avgPercentError) * 100;

          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: "0.85em", color: "#666" }}>
                  Total Projected ({pastWeeks.length} weeks)
                </div>
                <div style={{ fontSize: "1.5em", fontWeight: "bold" }}>
                  {totalProjected.toFixed(1)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.85em", color: "#666" }}>
                  Total Actual
                </div>
                <div style={{ fontSize: "1.5em", fontWeight: "bold" }}>
                  {totalActual.toFixed(1)}
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
                    color: totalDifference > 0 ? "green" : "red",
                  }}
                >
                  {totalDifference > 0 ? "+" : ""}
                  {totalDifference.toFixed(1)}
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
                    color: totalDifference > 0 ? "green" : "red",
                  }}
                >
                  {totalDifference > 0 ? "+" : ""}
                  {avgDifference.toFixed(1)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.85em", color: "#666" }}>
                  Accuracy Rate
                </div>
                <div style={{ fontSize: "1.5em", fontWeight: "bold" }}>
                  {accuracyRate.toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
