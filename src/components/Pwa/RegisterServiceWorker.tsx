"use client";

import { useEffect } from "react";

const registerServiceWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("SW registration failed", error);
  }
};

const RegisterServiceWorker = (): null => {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
};

export default RegisterServiceWorker;

