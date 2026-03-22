#!/usr/bin/env node
// ============================================================
// Psyche Chat — 单轮处理，维持状态文件
//
// Usage: node scripts/chat.js "你好呀"
//        node scripts/chat.js --reset   (重置状态)
// ============================================================

import { PsycheEngine, FileStorageAdapter } from "../dist/index.js";
import { existsSync } from "fs";
import { join } from "path";

const stateDir = join(import.meta.dirname, ".chat-state");
const statePath = join(stateDir, "psyche-state.json");
import { mkdirSync, rmSync } from "fs";

// Reset
if (process.argv[2] === "--reset") {
  if (existsSync(stateDir)) {
    rmSync(stateDir, { recursive: true });
    console.log("状态已重置");
  }
  process.exit(0);
}

// Ensure state dir exists
if (!existsSync(stateDir)) {
  mkdirSync(stateDir, { recursive: true });
}

const input = process.argv.slice(2).join(" ");
if (!input) {
  console.log("Usage: node scripts/chat.js \"你好呀\"");
  process.exit(0);
}

const engine = new PsycheEngine(
  { mbti: "ENFP", name: "Luna", locale: "zh", compactMode: true },
  new FileStorageAdapter(stateDir),
);
await engine.initialize();

const result = await engine.processInput(input);
const state = engine.getState();

// Output
console.log(`stimulus: ${result.stimulus ?? "null"}`);
console.log(`DA:${Math.round(state.current.DA)} HT:${Math.round(state.current.HT)} CORT:${Math.round(state.current.CORT)} OT:${Math.round(state.current.OT)} NE:${Math.round(state.current.NE)} END:${Math.round(state.current.END)}`);
console.log(`streak: ${state.agreementStreak} | turns: ${state.meta.totalInteractions}`);
console.log(`---`);
console.log(result.dynamicContext);
