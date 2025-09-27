"use client";

import * as React from "react";

export type DonutSlice = { label: string; value: number; color?: string };

export function DonutChart({
  data,
  size = 220,
  thickness = 20,
  gap = 2,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  gap?: number;
}) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  const radius = size / 2 - thickness / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const slices = data.map((d, i) => {
    const frac = Math.max(0, d.value) / total;
    const len = Math.max(0, circumference * frac - gap);
    const dashArray = `${len} ${circumference - len}`;
    const dashOffset = -offset;
    offset += circumference * frac;
    const color = d.color || palette[i % palette.length];
    return { d, dashArray, dashOffset, color, frac };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} opacity={0.3} />
        {slices.map((s, i) => (
          <circle
            key={i}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
            transform="rotate(-90)"
            strokeLinecap="butt"
          />
        ))}
      </g>
    </svg>
  );
}

const palette = [
  "hsl(var(--primary))",
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 280 65% 55%))",
  "hsl(var(--chart-3, 340 75% 55%))",
  "hsl(var(--chart-4, 30 85% 55%))",
  "hsl(var(--chart-5, 160 60% 45%))",
];

