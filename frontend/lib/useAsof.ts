"use client";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

let cached: string | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function snapshot(): string | null {
  return cached;
}

/** Publish a new reset date to every mounted badge (e.g. right after Seed demo). */
export function setAsofCache(v: string | null): void {
  cached = v;
  listeners.forEach((l) => l());
}

/** Reset date written by seed (AS_OF override or reset day). Null until loaded. */
export function useAsof(): string | null {
  const asof = useSyncExternalStore(subscribe, snapshot, () => null);
  useEffect(() => {
    if (cached !== null) return;
    let alive = true;
    api
      .health()
      .then((h) => {
        if (alive) setAsofCache(h.asof ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return asof;
}

export function asofMs(asof: string | null): number {
  const t = asof ? Date.parse(`${asof}T00:00:00Z`) : NaN;
  // Deterministic prerender placeholder (client hydrates with the real as-of).
  // Date.now() here breaks Next prerendering (unstable value), so never use it.
  return Number.isNaN(t) ? 0 : t;
}
