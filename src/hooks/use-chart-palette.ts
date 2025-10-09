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
      const next = [
        resolveColor("--primary", "rgb(56, 96, 255)"),
        resolveColor("--chart-1", "rgb(56, 96, 255)"),
        resolveColor("--chart-2", "rgb(56, 186, 172)"),
        resolveColor("--chart-3", "rgb(186, 56, 230)"),
        resolveColor("--chart-4", "rgb(255, 170, 32)"),
        resolveColor("--chart-5", "rgb(240, 85, 70)"),
        resolveColor("--muted-foreground", "rgb(120, 120, 120)"),
      ];
      setColors(next);
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
  return colors.length ? colors : ["#3860FF", "#3860FF", "#38BAAC", "#BA38E6", "#FFAA20", "#F05546", "#777777"];
}

