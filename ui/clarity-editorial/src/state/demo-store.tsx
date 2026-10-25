"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { DemoState, DemoUpdate, QuizState } from "../lib/types";
import { baselineQuestions } from "../data/content";

export const DEMO_STORAGE_KEY = "clarity-editorial:demo:v1";

function freshState(): DemoState {
  return {
    version: 1,
    baseline: { answers: {}, index: 0, completed: false },
    checkpoint: { answers: {}, index: 0, completed: false },
    habits: {}, habitsDone: false, goal: "buffer",
    completedLessons: [], lessonExercises: {}, lessonReflections: {},
    simulation: { income: 3600, rent: 1300, transportation: 300, spending: 1250, cash: 1500 },
    shock: "none", horizon: 12, actions: [], activity: [], sampleJourney: false,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validQuiz(value: unknown): value is QuizState {
  if (!record(value) || !record(value.answers) || !Number.isInteger(value.index) || Number(value.index) < 0 || Number(value.index) > 7 || typeof value.completed !== "boolean") return false;
  return Object.values(value.answers).every((answer) => answer === null || typeof answer === "string" && ["a", "b", "c", "d"].includes(answer));
}

function restore(raw: string | null): DemoState {
  if (!raw) return freshState();
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !validQuiz(value.baseline) || !validQuiz(value.checkpoint)) return freshState();
    const simulationLimits: Record<string, number> = { income: 15000, rent: 8000, transportation: 4000, spending: 8000, cash: 50000 };
    if (!record(value.simulation) || !Object.entries(simulationLimits).every(([key, max]) => typeof (value.simulation as Record<string, unknown>)[key] === "number" && Number.isFinite((value.simulation as Record<string, unknown>)[key]) && Number((value.simulation as Record<string, unknown>)[key]) >= 0 && Number((value.simulation as Record<string, unknown>)[key]) <= max)) return freshState();
    if (typeof value.shock !== "string" || !["none", "job-loss", "repair", "rent-rise"].includes(value.shock) || typeof value.horizon !== "number" || ![6, 12, 24].includes(value.horizon)) return freshState();
    if (!record(value.habits) || !Object.values(value.habits).every((item) => typeof item === "string") || typeof value.habitsDone !== "boolean" || typeof value.goal !== "string" || !["buffer", "debt", "budget"].includes(value.goal) || typeof value.sampleJourney !== "boolean") return freshState();
    if (!Array.isArray(value.completedLessons) || !value.completedLessons.every((id) => typeof id === "string") || !record(value.lessonExercises) || !Object.values(value.lessonExercises).every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= 1000000) || !record(value.lessonReflections) || !Object.values(value.lessonReflections).every((item) => typeof item === "string")) return freshState();
    if (!Array.isArray(value.actions) || !value.actions.every((item) => record(item) && typeof item.id === "string" && typeof item.kind === "string" && ["goal", "reminder"].includes(item.kind) && typeof item.title === "string" && typeof item.summary === "string" && typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount >= 0 && typeof item.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && typeof item.status === "string" && ["pending", "approved", "denied"].includes(item.status) && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) && (item.decidedAt === undefined || typeof item.decidedAt === "string" && Number.isFinite(Date.parse(item.decidedAt))))) return freshState();
    if (!Array.isArray(value.activity) || !value.activity.every((item) => record(item) && ["id", "title", "detail", "at"].every((key) => typeof item[key] === "string") && Number.isFinite(Date.parse(String(item.at))))) return freshState();
    return value as DemoState;
  } catch { return freshState(); }
}

type Snapshot = { state: DemoState; hydrated: boolean; storageAvailable: boolean };
const serverSnapshot: Snapshot = { state: freshState(), hydrated: false, storageAvailable: true };
let snapshot = serverSnapshot;
let loaded = false;
const listeners = new Set<() => void>();

function getSnapshot(): Snapshot {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { snapshot = { state: restore(window.sessionStorage.getItem(DEMO_STORAGE_KEY)), hydrated: true, storageAvailable: true }; }
    catch { snapshot = { state: freshState(), hydrated: true, storageAvailable: false }; }
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function update(change: DemoUpdate) {
  const current = getSnapshot();
  const next = change(current.state);
  if (next === current.state) return;
  const state = { ...next, activity: next.activity.slice(0, 100), actions: next.actions.slice(0, 100) };
  let storageAvailable = current.storageAvailable;
  try { window.sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); }
  catch { storageAvailable = false; }
  snapshot = { state, hydrated: true, storageAvailable };
  listeners.forEach((listener) => listener());
}

function reset() { update(() => freshState()); }

function loadSample() {
  update(() => {
    const state = freshState();
    const answers = Object.fromEntries(baselineQuestions.map((question, index) => [question.id, index % 2 === 0 ? question.correct_option_id : question.options.find((option) => option.id !== question.correct_option_id)!.id]));
    return { ...state, baseline: { answers, index: 7, completed: true }, sampleJourney: true, activity: [{ id: crypto.randomUUID(), title: "Example journey loaded", detail: "Starting profile: 4 of 8 concepts answered correctly. No personal assessment was taken.", at: new Date().toISOString() }] };
  });
}

export function useDemo() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return { ...current, update, reset, loadSample };
}

export function DemoProvider({ children }: { children: ReactNode }) { return children; }
