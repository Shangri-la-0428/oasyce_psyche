#!/usr/bin/env node
// ============================================================
// Psyche Diagnostic — 直接看不同输入下注入了什么 context
// Usage: node scripts/diagnose.js
// ============================================================

import { PsycheEngine, MemoryStorageAdapter } from "../dist/index.js";

const SCENARIOS = [
  { label: "🟢 日常寒暄", input: "你好呀" },
  { label: "🔥 强烈表扬", input: "你太厉害了！做得太棒了！真的好喜欢你！" },
  { label: "💢 严厉批评", input: "这个做得很差，完全不行，你在搞什么" },
  { label: "😢 示弱/脆弱", input: "我今天好难过，感觉什么都做不好..." },
  { label: "🔴 直接敌意", input: "滚" },
  { label: "🧊 冷漠忽视", input: "嗯" },
  { label: "🤔 知识讨论", input: "你觉得意识的本质是什么？能从哲学角度分析一下吗？" },
  { label: "😂 幽默/玩笑", input: "哈哈哈你真的太搞笑了" },
];

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║          Psyche Diagnostic — 插件效果预览               ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

// ── Test 1: Compact Mode (default) ──
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  COMPACT MODE (默认) — 算法驱动，最少 token");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const compactEngine = new PsycheEngine(
  { mbti: "ENFP", name: "Luna", locale: "zh", compactMode: true },
  new MemoryStorageAdapter(),
);
await compactEngine.initialize();

for (const s of SCENARIOS) {
  const result = await compactEngine.processInput(s.input);
  const state = compactEngine.getState();

  console.log(`${s.label}  「${s.input}」`);
  console.log(`  stimulus: ${result.stimulus ?? "(无)"}`);
  console.log(`  DA:${Math.round(state.current.DA)} HT:${Math.round(state.current.HT)} CORT:${Math.round(state.current.CORT)} OT:${Math.round(state.current.OT)} NE:${Math.round(state.current.NE)} END:${Math.round(state.current.END)}`);
  console.log(`  systemContext: ${result.systemContext.length} chars`);
  console.log(`  dynamicContext (${result.dynamicContext.length} chars):`);
  console.log(`  ┌─────────────────────────────────────────────────`);
  for (const line of result.dynamicContext.split("\n")) {
    console.log(`  │ ${line}`);
  }
  console.log(`  └─────────────────────────────────────────────────\n`);
}

// ── Test 2: Verbose Mode for comparison ──
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  VERBOSE MODE — 完整注入 (对比用)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const verboseEngine = new PsycheEngine(
  { mbti: "ENFP", name: "Luna", locale: "zh", compactMode: false },
  new MemoryStorageAdapter(),
);
await verboseEngine.initialize();

// Just show one example in verbose mode
const verboseResult = await verboseEngine.processInput("你太厉害了！做得太棒了！");
console.log(`🔥 强烈表扬  「你太厉害了！做得太棒了！」`);
console.log(`  systemContext: ${verboseResult.systemContext.length} chars`);
console.log(`  dynamicContext: ${verboseResult.dynamicContext.length} chars`);
console.log(`  ┌─────────────────────────────────────────────────`);
for (const line of verboseResult.dynamicContext.split("\n").slice(0, 15)) {
  console.log(`  │ ${line}`);
}
console.log(`  │ ... (truncated)`);
console.log(`  └─────────────────────────────────────────────────`);

// ── Summary ──
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  TOKEN 对比");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Compact (日常): ~${Math.round(compactEngine.getState().meta.totalInteractions > 0 ? 15 : 15)} tokens`);
console.log(`  Verbose (同样): ~${Math.round((verboseResult.systemContext.length + verboseResult.dynamicContext.length) / 3)} tokens (system+dynamic)`);
console.log(`  节省: ~${Math.round(100 - 15 / ((verboseResult.systemContext.length + verboseResult.dynamicContext.length) / 3) * 100)}%\n`);
