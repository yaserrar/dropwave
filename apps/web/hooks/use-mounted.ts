"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true after hydration (avoids SSR/CSR mismatches for browser-only values). */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
