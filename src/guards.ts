// ============================================================
// Type Guards — runtime validation for string→type conversions
// ============================================================

import type { ChemicalState, MBTIType, StimulusType } from "./types.js";
import { CHEMICAL_KEYS } from "./types.js";

const MBTI_TYPES = new Set<string>([
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
]);

const STIMULUS_TYPES = new Set<string>([
  "praise", "criticism", "humor", "intellectual", "intimacy",
  "conflict", "neglect", "surprise", "casual",
  "sarcasm", "authority", "validation", "boredom", "vulnerability",
]);

const CHEMICAL_KEY_SET = new Set<string>(CHEMICAL_KEYS);

export function isMBTIType(s: string): s is MBTIType {
  return MBTI_TYPES.has(s.toUpperCase());
}

export function isChemicalKey(s: string): s is keyof ChemicalState {
  return CHEMICAL_KEY_SET.has(s);
}

export function isStimulusType(s: string): s is StimulusType {
  return STIMULUS_TYPES.has(s);
}

/** Validate that a ChemicalState has all keys in [0, 100] */
export function isValidChemistry(c: unknown): c is ChemicalState {
  if (typeof c !== "object" || c === null) return false;
  const obj = c as Record<string, unknown>;
  for (const key of CHEMICAL_KEYS) {
    const v = obj[key];
    if (typeof v !== "number" || v < 0 || v > 100 || !isFinite(v)) return false;
  }
  return true;
}

/** Validate locale string */
export function isLocale(s: string): s is "zh" | "en" {
  return s === "zh" || s === "en";
}
