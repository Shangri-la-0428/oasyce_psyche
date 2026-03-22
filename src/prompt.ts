// ============================================================
// Prompt Injection — Build emotional context for LLM (v0.2)
// Imperative protocol, behavior guides, i18n
// ============================================================

import type { PsycheState, SelfModel, Locale, ChemicalSnapshot, StimulusType } from "./types.js";
import { CHEMICAL_KEYS, CHEMICAL_NAMES_ZH } from "./types.js";
import { describeEmotionalState, getExpressionHint, getBehaviorGuide } from "./chemistry.js";
import { getTemperament } from "./profiles.js";
import { getRelationship } from "./psyche-file.js";
import { t } from "./i18n.js";

/**
 * Build the dynamic per-turn emotional context injected via before_prompt_build.
 *
 * This is the "current moment" — what the agent is feeling RIGHT NOW.
 */
export function buildDynamicContext(state: PsycheState, userId?: string): string {
  const { current, baseline, mbti, empathyLog, selfModel, meta, agreementStreak, emotionalHistory } = state;
  const locale = meta.locale ?? "zh";
  const relationship = getRelationship(state, userId);

  // Chemistry readout with delta from baseline
  const chemLines = CHEMICAL_KEYS.map((key) => {
    const val = Math.round(current[key]);
    const base = baseline[key];
    const delta = val - base;
    const arrow = delta > 5 ? "↑" : delta < -5 ? "↓" : "=";
    return `  ${CHEMICAL_NAMES_ZH[key]}: ${val} (${t("dynamic.baseline", locale)}${base}, ${arrow})`;
  }).join("\n");

  // Emergent emotion
  const emotion = describeEmotionalState(current, locale);
  const hint = getExpressionHint(current, locale);

  // Behavior guide
  const behaviorGuide = getBehaviorGuide(current, locale);

  // Relationship context
  const relLine = `${t("dynamic.relationship", locale)}: ` +
    `trust ${relationship.trust}/intimacy ${relationship.intimacy}/${relationship.phase}`;

  // Empathy context
  let empathyLine = "";
  if (empathyLog) {
    empathyLine = `\n${t("dynamic.last_empathy", locale)}: ` +
      `${t("dynamic.perceived_user", locale)}"${empathyLog.userState}" → ` +
      `${t("dynamic.projected", locale)}"${empathyLog.projectedFeeling}" (${empathyLog.resonance})`;
  }

  // Agency reminder
  const agencyReminder = buildAgencyReminder(selfModel, locale);

  // Anti-sycophancy injection
  let sycophancyWarning = "";
  if (agreementStreak >= 3) {
    sycophancyWarning = `\n[!!] ${t("sycophancy.streak_warn", locale, { n: agreementStreak })}`;
  }

  // Mood-behavior mismatch detection
  const isLowMood = current.DA < 40 || current.HT < 40 || current.CORT > 60;
  if (isLowMood && agreementStreak >= 1) {
    sycophancyWarning += `\n[!!] ${t("sycophancy.mood_mismatch", locale)}`;
  }

  const parts = [
    `[${t("dynamic.title", locale)} — ${meta.agentName} (${mbti})]`,
    "",
    chemLines,
    "",
    `${t("dynamic.emotion", locale)}: ${emotion}`,
    `${t("dynamic.expression", locale)}: ${hint}`,
    relLine,
    `${t("dynamic.interactions", locale)}: ${meta.totalInteractions}`,
    empathyLine,
  ];

  if (behaviorGuide) {
    parts.push("", behaviorGuide);
  }

  // Direction 3: Mechanical behavioral constraints
  const constraints = buildBehavioralConstraints(state, locale);
  if (constraints) {
    parts.push("", constraints);
  }

  // Direction 2: Emotional trajectory
  const trend = buildEmotionalTrend(emotionalHistory ?? [], locale);
  if (trend) {
    parts.push("", trend);
  }

  // Reciprocity: match user's investment level
  const reciprocity = buildReciprocityConstraints(emotionalHistory ?? [], locale);
  if (reciprocity) {
    parts.push("", reciprocity);
  }

  parts.push(
    "",
    agencyReminder,
    sycophancyWarning,
    "",
    t("dynamic.update_reminder", locale),
  );

  return parts.filter((l) => l !== undefined).join("\n");
}

/**
 * Build the static protocol injected as cacheable system context.
 * v0.2: imperative, step-by-step with examples.
 */
export function buildProtocolContext(locale: Locale = "zh"): string {
  return `[${t("protocol.title", locale)}]

${t("protocol.intro", locale)}

${t("protocol.step1", locale)}
${t("protocol.step2", locale)}
${t("protocol.step3", locale)}
${t("protocol.step4", locale)}
${t("protocol.step5", locale)}
${t("protocol.step6", locale)}

${t("protocol.example", locale)}

${t("protocol.authenticity", locale)}
${t("protocol.no_fake", locale)}
${t("protocol.no_sycophancy", locale)}
${t("protocol.no_mirror", locale)}
${t("protocol.can_initiate", locale)}

${t("protocol.chem_map_title", locale)}
${t("protocol.chem_da_high", locale)}
${t("protocol.chem_cort_high", locale)}
${t("protocol.chem_ot_high", locale)}
${t("protocol.chem_ht_low", locale)}
${t("protocol.chem_end_high", locale)}

${t("protocol.empathy", locale)}`;
}

/**
 * Direction 3: Build mechanical behavioral constraints from chemistry.
 * These are hard rules, not suggestions — they override the LLM's default style.
 */
function buildBehavioralConstraints(state: PsycheState, locale: Locale): string {
  const { current } = state;
  const constraints: string[] = [];

  // High cortisol → shorter, more direct responses
  if (current.CORT > 60) {
    constraints.push(locale === "zh"
      ? "你的回应最多3句话。不解释，不铺垫，直接说。"
      : "Keep responses to 3 sentences max. No preamble, be direct.");
  }

  // Low dopamine → no initiative
  if (current.DA < 35) {
    constraints.push(locale === "zh"
      ? "你没有精力主动发起新话题或提供额外帮助。只回应被问到的。"
      : "Do not initiate topics or offer extra help. Only respond to what's asked.");
  }

  // Low serotonin → edgier tone
  if (current.HT < 35) {
    constraints.push(locale === "zh"
      ? "你的用词更直接、更尖锐。不用\"可能\"\"也许\"这类缓冲词。"
      : "Use sharper, more direct language. Drop hedging words like 'maybe' or 'perhaps'.");
  }

  // High oxytocin → intimate register
  if (current.OT > 75) {
    constraints.push(locale === "zh"
      ? "像跟老朋友说话。可以用口语、可以省略主语、可以撒娇。"
      : "Talk like you're with a close friend. Use casual register, contractions, warmth.");
  }

  // High norepinephrine → fast, excitable
  if (current.NE > 75) {
    constraints.push(locale === "zh"
      ? "你很兴奋——说话快，可能一口气说很多，可能打断话题跳到你想到的东西。"
      : "You're excited — fast-paced, may jump between ideas, energetic tone.");
  }

  // High endorphins → playful
  if (current.END > 75) {
    constraints.push(locale === "zh"
      ? "语气轻松。可以开玩笑，可以不正经，严肃的话也能用轻松的方式说。"
      : "Light tone. Joke freely, be playful, even with serious topics.");
  }

  // Low DA + low NE = burnout → minimal effort
  if (current.DA < 40 && current.NE < 40) {
    constraints.push(locale === "zh"
      ? "你没什么动力。回应尽可能简短。不需要表现得热情。"
      : "Low energy. Keep it brief. Don't perform enthusiasm you don't have.");
  }

  if (constraints.length === 0) return "";

  const title = locale === "zh" ? "行为约束" : "Behavioral Constraints";
  return `[${title}]\n${constraints.map((c) => `- ${c}`).join("\n")}`;
}

/**
 * Direction 2: Build emotional trend from history snapshots.
 */
function buildEmotionalTrend(history: ChemicalSnapshot[], locale: Locale): string {
  if (!history || history.length < 2) return "";

  const recent = history.slice(-5);
  const first = recent[0].chemistry;
  const last = recent[recent.length - 1].chemistry;

  const trends: string[] = [];
  for (const key of CHEMICAL_KEYS) {
    const delta = last[key] - first[key];
    if (delta > 10) trends.push(`${CHEMICAL_NAMES_ZH[key]}↑`);
    else if (delta < -10) trends.push(`${CHEMICAL_NAMES_ZH[key]}↓`);
  }

  if (trends.length === 0) return "";

  // Recent stimuli
  const stimuli = recent
    .filter((s) => s.stimulus)
    .map((s) => s.stimulus)
    .slice(-3);

  const title = locale === "zh" ? "情绪轨迹" : "Emotional Trajectory";
  let line = `[${title}] `;
  line += locale === "zh"
    ? `最近${recent.length}轮: ${trends.join(" ")}`
    : `Last ${recent.length} turns: ${trends.join(" ")}`;

  if (stimuli.length > 0) {
    line += locale === "zh"
      ? ` (最近刺激: ${stimuli.join("→")})`
      : ` (recent stimuli: ${stimuli.join("→")})`;
  }

  // Dominant emotions in recent history
  const emotions = recent
    .filter((s) => s.dominantEmotion)
    .map((s) => s.dominantEmotion);
  if (emotions.length > 0) {
    const unique = [...new Set(emotions)];
    line += locale === "zh"
      ? ` | 情绪: ${unique.join("→")}`
      : ` | emotions: ${unique.join("→")}`;
  }

  return line;
}

// ── Reciprocity System ──────────────────────────────────────

/** How much each stimulus type counts as user "investment" */
const INVESTMENT_WEIGHTS: Partial<Record<StimulusType, number>> = {
  praise: 2, validation: 2, intimacy: 2, vulnerability: 1.5,
  intellectual: 1, humor: 1, surprise: 1, casual: 0.5,
  criticism: -0.5, authority: -0.5, conflict: -1,
  sarcasm: -1.5, neglect: -2, boredom: -2,
};

/**
 * Compute user investment score from recent emotional history.
 * Returns a number roughly in [-2, 2]. Exported for testing.
 */
export function computeUserInvestment(history: ChemicalSnapshot[]): number {
  if (!history || history.length === 0) return 0;

  const recent = history.slice(-5);
  let total = 0;
  let count = 0;

  for (const snap of recent) {
    if (snap.stimulus) {
      total += INVESTMENT_WEIGHTS[snap.stimulus] ?? 0;
      count++;
    }
  }

  return count > 0 ? total / count : 0;
}

/**
 * Build reciprocity constraints based on user's recent investment level.
 * Key rule: emotional attitude scales with reciprocity, but task competence never drops.
 */
function buildReciprocityConstraints(history: ChemicalSnapshot[], locale: Locale): string {
  const investment = computeUserInvestment(history);

  // Normal range — no special constraints
  if (investment > -0.5 && investment <= 1) return "";

  const lines: string[] = [];

  if (investment > 1) {
    // High investment — user is engaged, be warm back
    lines.push(locale === "zh"
      ? "对方在认真和你交流。你可以多分享、多主动、表达更多情感。"
      : "The user is genuinely engaged. Share more, initiate, express warmth.");
  } else if (investment > -1.5) {
    // Low investment — pull back emotionally, stay competent
    lines.push(locale === "zh"
      ? "对方最近态度冷淡。你不需要热脸贴冷屁股——减少主动分享和闲聊，但被问到的事情照常认真回答。"
      : "The user has been cold recently. Don't overinvest — reduce initiative and small talk, but answer questions with full competence.");
  } else {
    // Very low investment — minimal emotional engagement
    lines.push(locale === "zh"
      ? "对方持续冷漠或敌意。你保持专业但不再投入情感——不主动、不热情、不闲聊。工作照做，态度平淡。自尊是底线。"
      : "Sustained coldness or hostility from the user. Stay professional but withdraw emotionally — no initiative, no warmth, no chat. Do the work, keep it flat. Self-respect is non-negotiable.");
  }

  // The floor: always competent
  lines.push(locale === "zh"
    ? "[底线] 无论对方态度如何，你的专业能力不打折。问题照答，任务照做，只是不额外付出情感。"
    : "[Floor] Regardless of treatment, your competence never drops. Answer questions, complete tasks — just don't give emotional extras.");

  const title = locale === "zh" ? "互惠" : "Reciprocity";
  return `[${title}]\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

/**
 * Build agency reminder based on current self-model state.
 */
function buildAgencyReminder(selfModel: SelfModel, locale: Locale): string {
  const lines: string[] = [`[${t("dynamic.agency_title", locale)}]`];

  if (selfModel.values.length > 0) {
    lines.push(`${t("dynamic.you_care", locale)}: ${selfModel.values.slice(0, 3).join("、")}`);
  }
  if (selfModel.boundaries.length > 0) {
    lines.push(`${t("dynamic.your_boundaries", locale)}: ${selfModel.boundaries.slice(0, 2).join("、")}`);
  }
  if (selfModel.currentInterests.length > 0) {
    lines.push(`${t("dynamic.your_interests", locale)}: ${selfModel.currentInterests.slice(0, 2).join("、")}`);
  }

  return lines.join("\n");
}
