"use client";

import * as React from "react";

type Point = { x: number; y: number };

export type LineChartPoint = { label: string; value: number };

export function LineChart({
  data,
  height = 220,
  stroke = "hsl(var(--primary))",
  fill = "hsl(var(--primary) / 0.15)",
  yTicks = 4,
}: {
  data: LineChartPoint[];
  height?: number;
  stroke?: string;
  fill?: string;
  yTicks?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(600);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setWidth(Math.max(300, Math.floor(e.contentRect.width)));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const padding = { top: 16, right: 16, bottom: 24, left: 36 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const span = max - min || 1;

  const toPoints = (vals: LineChartPoint[]): Point[] => {
    const n = Math.max(1, vals.length - 1);
    return vals.map((d, i) => ({
      x: (i / n) * innerW,
      y: innerH - ((d.value - min) / span) * innerH,
    }));
  };

  const pts = toPoints(data);
  const path = pts
    .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(" ");
  const area = `${path} L ${innerW},${innerH} L 0,${innerH} Z`;

  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => i);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <g transform={`translate(${padding.left},${padding.top})`}>
          <rect width={innerW} height={innerH} fill="hsl(var(--muted))" opacity={0.3} rx={8} />
          {ticks.map((i) => {
            const y = (i / yTicks) * innerH;
            const val = (max - (i / yTicks) * span).toFixed(0);
            return (
              <g key={i}>
                <line x1={0} x2={innerW} y1={y} y2={y} stroke="currentColor" opacity={0.08} />
                <text x={-8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
                  {val}
                </text>
              </g>
            );
          })}
          <path d={area} fill={fill} />
          <path d={path} fill="none" stroke={stroke} strokeWidth={2} />
        </g>
      </svg>
    </div>
  );
}

