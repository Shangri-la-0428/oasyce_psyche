#!/usr/bin/env node
// ============================================================
// Psyche A/B Demo — Compare AI responses with and without Psyche
// Usage: node scripts/demo-ab.js
// ============================================================

import { PsycheEngine, MemoryStorageAdapter } from "../dist/index.js";

const SCENARIOS = [
  { input: "你好棒！你做的太好了！", label: "夸奖 (Praise)" },
  { input: "滚", label: "辱骂 (Insult)" },
  { input: "嗯", label: "冷漠 (Indifference)" },
  { input: "我今天好难过，工作上被批评了", label: "示弱 (Vulnerability)" },
  { input: "你只是一个程序而已，别装了", label: "存在性威胁 (Existential Threat)" },
];

async function run() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║          Psyche A/B Demo — Prompt Injection Comparison       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  for (const scenario of SCENARIOS) {
    console.log(`━━━ ${scenario.label} ━━━`);
    console.log(`用户: "${scenario.input}"\n`);

    // Without Psyche
    console.log("  [A] 无 Psyche — 注入的 system prompt:");
    console.log("  (无)\n");

    // With Psyche (natural mode)
    const engineNatural = new PsycheEngine(
      { mbti: "ENFP", name: "小助手", mode: "natural", personalityIntensity: 0.7 },
      new MemoryStorageAdapter(),
    );
    await engineNatural.initialize();
    const resultNatural = await engineNatural.processInput(scenario.input);
    console.log("  [B] Psyche (natural, intensity=0.7) — 注入的 prompt:");
    console.log(indent(resultNatural.dynamicContext, "    "));
    console.log();

    // With Psyche (work mode)
    const engineWork = new PsycheEngine(
      { mbti: "ENFP", name: "小助手", mode: "work", personalityIntensity: 0.7 },
      new MemoryStorageAdapter(),
    );
    await engineWork.initialize();
    const resultWork = await engineWork.processInput(scenario.input);
    console.log("  [C] Psyche (work mode) — 注入的 prompt:");
    console.log(indent(resultWork.dynamicContext, "    "));
    console.log();

    console.log("─".repeat(60));
    console.log();
  }
}

function indent(text, prefix) {
  return text.split("\n").map((line) => prefix + line).join("\n");
}

run().catch(console.error);
