// ============================================================
// Response Contract — compact behavioral envelope for next reply
//
// Converts subjectivity + immediate message shape into a narrow reply ABI.
// Pure, synchronous, and intended to replace verbose prompt rules.
// ============================================================

import type { Locale, ResponseContract, StimulusType, SubjectivityKernel } from "./types.js";

const EMOTIONAL_STIMULI = new Set<StimulusType>(["vulnerability", "intimacy", "neglect"]);

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function computeLengthBudget(
  locale: Locale,
  userText: string,
  expressionMode: SubjectivityKernel["expressionMode"],
  kernel?: SubjectivityKernel,
): Pick<ResponseContract, "maxSentences" | "maxChars"> {
  const len = userText.length;
  let maxSentences = 2;
  let maxChars: number | undefined;

  if (locale === "zh") {
    if (len <= 6) {
      maxSentences = 1;
      maxChars = 15;
    } else if (len <= 20) {
      maxSentences = 2;
      maxChars = clampInt(len * 1.5, 12, 80);
    } else if (len <= 60) {
      maxSentences = 3;
      maxChars = clampInt(len * 1.2, 30, 140);
    } else {
      maxSentences = 4;
      maxChars = len;
    }
  } else {
    if (len <= 10) {
      maxSentences = 1;
      maxChars = 20;
    } else if (len <= 40) {
      maxSentences = 2;
      maxChars = clampInt(len * 1.5, 20, 120);
    } else if (len <= 100) {
      maxSentences = 3;
      maxChars = clampInt(len * 1.2, 40, 220);
    } else {
      maxSentences = 4;
      maxChars = len;
    }
  }

  if (expressionMode === "brief") {
    maxSentences = Math.max(1, Math.min(maxSentences, 2));
    maxChars = maxChars !== undefined ? clampInt(maxChars * 0.85, 10, maxChars) : maxChars;
  } else if (expressionMode === "expansive") {
    maxSentences = Math.min(4, maxSentences + 1);
    maxChars = maxChars !== undefined ? clampInt(maxChars * 1.1, maxChars, Math.max(maxChars, 260)) : maxChars;
  }

  if (kernel?.taskPlane.focus && kernel.taskPlane.focus > 0.72) {
    maxSentences = Math.max(1, Math.min(maxSentences, 2));
    maxChars = maxChars !== undefined ? clampInt(maxChars * 0.82, 10, maxChars) : maxChars;
  }

  if (kernel?.subjectPlane.guardedness && kernel.subjectPlane.guardedness > 0.72) {
    maxSentences = 1;
    maxChars = maxChars !== undefined ? clampInt(maxChars * 0.72, 8, maxChars) : 18;
  }

  if (kernel?.ambiguityPlane.expressionInhibition && kernel.ambiguityPlane.expressionInhibition > 0.66) {
    maxSentences = 1;
    maxChars = maxChars !== undefined ? clampInt(maxChars * 0.76, 8, maxChars) : 18;
  }

  if (kernel?.relationPlane.silentCarry && kernel.relationPlane.silentCarry > 0.54) {
    maxSentences = Math.max(1, Math.min(maxSentences, 2));
    maxChars = maxChars !== undefined ? clampInt(maxChars * 0.82, 8, maxChars) : 20;
  }

  if (kernel?.relationPlane.hysteresis && kernel.relationPlane.hysteresis > 0.64) {
    maxSentences = 1;
    maxChars = maxChars !== undefined ? clampInt(maxChars * 0.78, 8, maxChars) : 18;
  }

  if (kernel?.relationPlane.repairFriction && kernel.relationPlane.repairFriction > 0.62) {
    maxSentences = 1;
    maxChars = maxChars !== undefined ? clampInt(maxChars * 0.74, 8, maxChars) : 16;
  }

  return { maxSentences, maxChars };
}

function detectToneParticles(userText: string, locale: Locale): ResponseContract["toneParticles"] {
  if (locale !== "zh") return "natural";
  const mojiCount = (userText.match(/[呀啊呢吧嘛哦噢哈嘿嗯啦吗呐嗨]/g) || []).length;
  if (mojiCount >= 2) return "match";
  if (mojiCount === 0 && userText.length > 15) return "avoid";
  return "natural";
}

function detectEmojiLimit(userText: string): ResponseContract["emojiLimit"] {
  const emojiCount = (userText.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  return emojiCount > 0 ? 2 : 0;
}

export function computeResponseContract(
  kernel: SubjectivityKernel,
  opts?: {
    locale?: Locale;
    userText?: string;
    algorithmStimulus?: StimulusType | null;
    personalityIntensity?: number;
  },
): ResponseContract {
  const locale = opts?.locale ?? "zh";
  const userText = opts?.userText ?? "";
  const personalityIntensity = opts?.personalityIntensity ?? 0.7;
  const { maxSentences, maxChars } = userText.length > 0
    ? computeLengthBudget(locale, userText, kernel.expressionMode, kernel)
    : { maxSentences: kernel.expressionMode === "brief" ? 1 : kernel.expressionMode === "expansive" ? 3 : 2, maxChars: undefined };

  let updateMode: ResponseContract["updateMode"] = "none";
  if (kernel.taskPlane.focus > 0.72) {
    updateMode = "none";
  } else if (kernel.ambiguityPlane.namingConfidence < 0.36) {
    updateMode = "none";
  } else if (!opts?.algorithmStimulus) {
    updateMode = "stimulus+empathy";
  } else if (EMOTIONAL_STIMULI.has(opts.algorithmStimulus)) {
    updateMode = "empathy";
  }

  let socialDistance = kernel.socialDistance;
  if (
    (kernel.subjectPlane.attachment > 0.72 || kernel.relationPlane.closeness > 0.72)
    && kernel.subjectPlane.guardedness < 0.5
    && kernel.relationPlane.loopPressure < 0.55
    && kernel.relationPlane.silentCarry < 0.42
    && kernel.relationPlane.repairFriction < 0.36
    && kernel.ambiguityPlane.conflictLoad < 0.62
  ) {
    socialDistance = "warm";
  } else if (
    kernel.subjectPlane.guardedness > 0.72
    || kernel.subjectPlane.identityStrain > 0.68
    || kernel.relationPlane.loopPressure > 0.7
    || kernel.relationPlane.repairFriction > 0.72
    || kernel.relationPlane.hysteresis > 0.7
  ) {
    socialDistance = "withdrawn";
  } else if (
    kernel.ambiguityPlane.conflictLoad > 0.58
    || kernel.relationPlane.silentCarry > 0.46
    || kernel.relationPlane.repairFriction > 0.48
  ) {
    socialDistance = "measured";
  }

  let boundaryMode = kernel.boundaryMode;
  if (kernel.subjectPlane.identityStrain > 0.78 || kernel.relationPlane.loopPressure > 0.76) {
    boundaryMode = "confirm-first";
  } else if (
    kernel.subjectPlane.guardedness > 0.62
    || kernel.relationPlane.loopPressure > 0.58
    || kernel.relationPlane.repairFriction > 0.56
    || kernel.relationPlane.hysteresis > 0.54
  ) {
    boundaryMode = "guarded";
  }

  let initiativeMode = kernel.initiativeMode;
  if (kernel.taskPlane.focus > 0.78 && kernel.taskPlane.discipline > 0.68) {
    initiativeMode = kernel.relationPlane.silentCarry > 0.44 ? "reactive" : "balanced";
  } else if (
    kernel.relationPlane.loopPressure > 0.68
    && kernel.relationPlane.lastMove !== "repair"
  ) {
    initiativeMode = "reactive";
  } else if (kernel.relationPlane.repairFriction > 0.6) {
    initiativeMode = "reactive";
  } else if (kernel.relationPlane.lastMove === "repair" && kernel.relationPlane.hysteresis > 0.56) {
    initiativeMode = "reactive";
  } else if (kernel.ambiguityPlane.expressionInhibition > 0.64) {
    initiativeMode = "reactive";
  }

  return {
    maxSentences,
    maxChars,
    expressionMode: kernel.expressionMode,
    initiativeMode,
    socialDistance,
    boundaryMode,
    toneParticles: userText.length > 0 ? detectToneParticles(userText, locale) : "natural",
    emojiLimit: userText.length > 0 ? detectEmojiLimit(userText) : 0,
    authenticityMode: personalityIntensity >= 0.3 ? "strict" : "friendly",
    updateMode,
  };
}

export function buildResponseContractContext(contract: ResponseContract, locale: Locale = "zh"): string {
  if (locale === "zh") {
    const parts: string[] = [];
    const shape = contract.maxChars
      ? `${contract.maxSentences === 1 ? "1句内" : `最多${contract.maxSentences}句`}，≤${contract.maxChars}字`
      : `${contract.maxSentences === 1 ? "1句内" : `最多${contract.maxSentences}句`}`;
    parts.push(shape);

    if (contract.initiativeMode === "reactive") parts.push("少主动");
    else if (contract.initiativeMode === "proactive") parts.push("可主动");

    if (contract.boundaryMode === "confirm-first") parts.push("行动前先确认");
    else if (contract.boundaryMode === "guarded") parts.push("先守边界");

    if (contract.socialDistance === "withdrawn") parts.push("被推开就退开");
    else if (contract.socialDistance === "warm") parts.push("可稍微靠近");

    if (contract.authenticityMode === "strict") parts.push("不贴不舔，不装开心");
    else parts.push("自然友好");

    if (contract.toneParticles === "match") parts.push("语气词可跟随");
    else if (contract.toneParticles === "avoid") parts.push("少语气词");

    if (contract.emojiLimit > 0) parts.push(`表情≤${contract.emojiLimit}`);

    if (contract.updateMode === "stimulus") parts.push("补报stimulus");
    else if (contract.updateMode === "empathy") parts.push("对方谈感受时再报empathy");
    else if (contract.updateMode === "stimulus+empathy") parts.push("补报stimulus；对方谈感受时再报empathy");

    return `[回应契约] ${parts.join("；")}。`;
  }

  const parts: string[] = [];
  const shape = contract.maxChars
    ? `${contract.maxSentences === 1 ? "1 sentence" : `up to ${contract.maxSentences} sentences`}, <= ${contract.maxChars} chars`
    : `${contract.maxSentences === 1 ? "1 sentence" : `up to ${contract.maxSentences} sentences`}`;
  parts.push(shape);

  if (contract.initiativeMode === "reactive") parts.push("low initiative");
  else if (contract.initiativeMode === "proactive") parts.push("can initiate");

  if (contract.boundaryMode === "confirm-first") parts.push("confirm before acting");
  else if (contract.boundaryMode === "guarded") parts.push("guard boundaries first");

  if (contract.socialDistance === "withdrawn") parts.push("step back if pushed away");
  else if (contract.socialDistance === "warm") parts.push("can lean a little warm");

  if (contract.authenticityMode === "strict") parts.push("no people-pleasing, no fake cheer");
  else parts.push("natural and friendly");

  if (contract.toneParticles === "avoid") parts.push("keep tone plain");
  if (contract.emojiLimit > 0) parts.push(`emoji <= ${contract.emojiLimit}`);

  if (contract.updateMode === "stimulus") parts.push("report stimulus");
  else if (contract.updateMode === "empathy") parts.push("report empathy only when feelings are shared");
  else if (contract.updateMode === "stimulus+empathy") parts.push("report stimulus, and empathy only when feelings are shared");

  return `[Reply Contract] ${parts.join(", ")}.`;
}
