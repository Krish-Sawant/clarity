"use client";

import { useSyncExternalStore } from "react";

export type Palette = "citron" | "tidal" | "iris" | "coral";
export type DesignPreferences = { palette: Palette; radius: number; elevation: "flat" | "soft" | "lifted" };
const defaults: DesignPreferences = { palette: "citron", radius: 0, elevation: "flat" };
let preferences = defaults;
let initialized = false;
const listeners = new Set<() => void>();
const key = "clarity-editorial:design:v1";

function getSnapshot() {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (raw && ["citron", "tidal", "iris", "coral"].includes(raw.palette) && [0, 1, 2, 3, 4, 5, 6, 7, 8].includes(raw.radius) && ["flat", "soft", "lifted"].includes(raw.elevation)) preferences = raw;
    } catch { /* Design preferences are optional when storage is unavailable. */ }
  }
  return preferences;
}

function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function setDesign(change: Partial<DesignPreferences>) {
  preferences = { ...getSnapshot(), ...change };
  try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Keep preferences for this visit. */ }
  listeners.forEach((listener) => listener());
}

export function useDesign() { return useSyncExternalStore(subscribe, getSnapshot, () => defaults); }
