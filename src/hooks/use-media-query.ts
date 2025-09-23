"use client";

import { useEffect, useState } from "react";

export enum MQBreakpoint {
  Sm = 640,
  Md = 768,
  Lg = 1024,
  Xl = 1280,
  TwoXl = 1536,
}

export function useMediaQuery(query: string) {
  const getMatches = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener("change", listener);
    setMatches(mediaQueryList.matches);
    return () => mediaQueryList.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
