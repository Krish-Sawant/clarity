/**
 * Bundled, synthetic demo content copied from the current repository fixtures.
 * Answer keys belong to DEMO MODE only. This module must never be imported by a
 * live assessment adapter; a future live API must omit keys and score server-side.
 */
import baselineBank from "./baseline_questions.json";
import checkpointBank from "./checkpoint_questions.json";
import lessonContent from "./lessons.json";
import sourceRegistry from "./sources_fallback.json";
import type { Lesson, Question, Source } from "../lib/types";

export const baselineQuestions = baselineBank.questions as Question[];
export const checkpointQuestions = checkpointBank.questions as Question[];
export const lessons = lessonContent.lessons as Lesson[];
export const sources = sourceRegistry.sources as Source[];
export const contentVersions = {
  baseline: baselineBank.bank_version,
  checkpoint: checkpointBank.bank_version,
  lessons: lessonContent.content_version,
};
