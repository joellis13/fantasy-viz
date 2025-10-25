import React from "react";
import { Group } from "@visx/group";
import { scaleLinear, scalePoint } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";

type Point = { week: number; teamName: string; score: number };

type Props = { data: Point[] };

export default function LineChartVisx({ data }: Props) {
  if (!data || data.length === 0) {
    return <div>No data to show</div>;
  }

  const teams = Array.from(new Set(data.map((d) => d.teamName)));
  const weeks = Array.from(new Set(data.map((d) => d.week))).sort((a, b) => a - b);

  const series = teams.map((team) => ({
    team,
    points: weeks.map((w) => {
      const p = data.find((d) => d.week === w && d.teamName === team);
      return { week: w, score: p ? p.score : null };
    })
  }));

  const width = 800;
  const height = 400;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };

  const xScale = scalePoint<number>({
    domain: weeks,
    range: [margin.left, width - margin.right]
  });

  const allScores = data.map((d) => d.score);
  const yMin = Math.min(...allScores) - 5;
  const yMax = Math.max(...allScores) + 5;

  const yScale = scaleLinear<number>({
    domain: [yMin, yMax],
    range: [height - margin.bottom, margin.top],
    nice: true
  });

  const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];

  return (
    <div style={{ width: "100%", overflow: "auto" }}>
      <svg width={width} height={height}>
        <rect x={0} y={0} width={width} height={height} fill="#fff" rx={6} />
        <Group>
          <AxisLeft scale={yScale} left={margin.left} />
          <AxisBottom scale={xScale} top={height - margin.bottom} />
          {series.map((s, i) => (
            <LinePath
              key={s.team}
              data={s.points.filter((p) => p.score !== null) as { week: number; score: number }[]}
              x={(d) => xScale(d.week) || 0}
              y={(d) => yScale(d.score)}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
            />
          ))}
        </Group>
      </svg>
      <div style={{ marginTop: 8 }}>
        <strong>Legend:</strong> {teams.map((t, i) => (
          ` ${t}`
        ))}
      </div>
    </div>
  );
}