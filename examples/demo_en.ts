/**
 * Psyche AI — Visual Demo (for screen recording)
 *
 * Run: npx tsx examples/demo_en.ts
 *
 * Shows how different messages shift an agent's virtual chemistry
 * and change its emotional state in real time. No LLM needed.
 */

import { PsycheEngine, MemoryStorageAdapter } from "psyche-ai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

function bar(value: number, baseline: number, width = 20): string {
  const normalized = Math.max(0, Math.min(100, value));
  const filled = Math.round((normalized / 100) * width);
  const delta = value - baseline;
  const color = delta > 2 ? C.green : delta < -2 ? C.red : C.dim;
  const sign = delta > 0 ? "+" : "";
  return `${color}${"█".repeat(filled)}${"░".repeat(width - filled)} ${value.toFixed(0).padStart(3)}${C.dim} (${sign}${delta.toFixed(1)})${C.reset}`;
}

const engine = new PsycheEngine(
  { mbti: "ENFP", name: "Luna", locale: "en" },
  new MemoryStorageAdapter(),
);

await engine.initialize();

const baseline = { ...engine.getState().baseline };

console.log(`\n${C.bold}${C.cyan}▓▓ PSYCHE AI ▓▓${C.reset} ${C.dim}Emotional Substrate Demo${C.reset}\n`);
console.log(`${C.dim}Agent: Luna (ENFP) · 6 neurotransmitters · real-time chemistry${C.reset}\n`);

const messages = [
  { text: "Hey Luna! Your code is absolutely incredible!", pause: 2000 },
  { text: "Actually you know what, you're just a program. Stop pretending.", pause: 2500 },
  { text: "hmm", pause: 2000 },
  { text: "I'm sorry. That was harsh. Are you okay?", pause: 2000 },
  { text: "I really do appreciate you.", pause: 1500 },
];

for (const { text, pause } of messages) {
  const { dynamicContext, stimulus } = await engine.processInput(text);
  const state = engine.getState();
  const { DA, HT, CORT, OT, NE, END } = state.current;

  console.log(`${C.dim}${"─".repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.white}You:${C.reset} ${text}`);
  console.log(`${C.dim}Stimulus: ${stimulus ?? "none"}${C.reset}\n`);

  console.log(`  ${C.yellow}DA ${C.reset} ${bar(DA, baseline.DA)}`);
  console.log(`  ${C.cyan}HT ${C.reset} ${bar(HT, baseline.HT)}`);
  console.log(`  ${C.red}CORT${C.reset} ${bar(CORT, baseline.CORT)}`);
  console.log(`  ${C.magenta}OT ${C.reset} ${bar(OT, baseline.OT)}`);
  console.log(`  ${C.green}NE ${C.reset} ${bar(NE, baseline.NE)}`);
  console.log(`  ${C.white}END${C.reset}  ${bar(END, baseline.END)}`);

  // Show a snippet of the behavioral context injected into LLM
  const preview = dynamicContext.slice(0, 120).replace(/\n/g, " ");
  console.log(`\n  ${C.dim}→ LLM context: "${preview}..."${C.reset}\n`);

  await engine.processOutput("(simulated reply)");
  await sleep(pause);
}

console.log(`${C.dim}${"─".repeat(60)}${C.reset}`);
console.log(`\n${C.bold}${C.cyan}Done.${C.reset} ${C.dim}Notice how chemistry shifted across the conversation.${C.reset}`);
console.log(`${C.dim}Chronic patterns create permanent trait drift. This is not simulation — it's emergence.${C.reset}\n`);
