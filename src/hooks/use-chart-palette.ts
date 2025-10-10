"use client";

import { useEffect, useState } from "react";

export function useChartPalette() {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resolveColor = (cssVar: string, fallback: string) => {
      const el = document.createElement("span");
      el.style.color = `var(${cssVar}, ${fallback})`;
      document.body.appendChild(el);
      const rgb = getComputedStyle(el).color || fallback;
      el.remove();
      return rgb;
    };

    const compute = () => {
      const varNames = [
        "--chart-1",
        "--chart-2",
        "--chart-3",
        "--chart-4",
        "--chart-5",
        "--chart-6",
        "--chart-7",
        "--chart-8",
        "--chart-9",
        "--chart-10",
        "--chart-11",
        "--chart-12",
        "--chart-13",
        "--chart-14",
        "--chart-15",
        "--chart-16",
      ];
      const brightFallback = [
        "#4F46E5", // indigo-600
        "#10B981", // emerald-500
        "#F59E0B", // amber-500
        "#EF4444", // red-500
        "#3B82F6", // blue-500
        "#8B5CF6", // violet-500
        "#EC4899", // pink-500
        "#22C55E", // green-500
        "#F97316", // orange-500
        "#06B6D4", // cyan-500
        "#84CC16", // lime-500
        "#EAB308", // yellow-500
        "#DB2777", // rose-600
        "#0EA5E9", // sky-500
        "#A855F7", // purple-500
        "#14B8A6", // teal-500
      ];
      const resolved = varNames.map((vn, i) => resolveColor(vn, brightFallback[i % brightFallback.length]));
      setColors(resolved);
    };

    compute();

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "class") {
          compute();
          break;
        }
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return colors.length
    ? colors
    : [
        "#4F46E5",
        "#10B981",
        "#F59E0B",
        "#EF4444",
        "#3B82F6",
        "#8B5CF6",
        "#EC4899",
        "#22C55E",
        "#F97316",
        "#06B6D4",
        "#84CC16",
        "#EAB308",
        "#DB2777",
        "#0EA5E9",
        "#A855F7",
        "#14B8A6",
      ];
}
