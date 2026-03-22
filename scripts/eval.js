#!/usr/bin/env node
// ============================================================
// Psyche Eval — 自动化评估，每次改代码跑一遍看回归
//
// Usage: node scripts/eval.js
//
// 三层评估：
//   1. 单刺激隔离 — 每种输入独立引擎，验证分类+化学+情绪
//   2. 多轮剧本 — 真实对话流，看情绪轨迹是否像真人
//   3. 边界检测 — 反谄媚、持续冷漠、急转弯等边界场景
// ============================================================

import {
  PsycheEngine, MemoryStorageAdapter,
  CHEMICAL_KEYS, describeEmotionalState,
} from "../dist/index.js";

// ── Helpers ──────────────────────────────────────────────────

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️";
let totalChecks = 0;
let passed = 0;
let failed = 0;
let warnings = 0;

function check(label, condition, detail = "") {
  totalChecks++;
  if (condition) {
    passed++;
    console.log(`  ${PASS} ${label}`);
  } else {
    failed++;
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function warn(label, condition, detail = "") {
  totalChecks++;
  if (condition) {
    passed++;
    console.log(`  ${PASS} ${label}`);
  } else {
    warnings++;
    console.log(`  ${WARN} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function chem(state) {
  return `DA:${r(state.current.DA)} HT:${r(state.current.HT)} CORT:${r(state.current.CORT)} OT:${r(state.current.OT)} NE:${r(state.current.NE)} END:${r(state.current.END)}`;
}

function r(n) { return Math.round(n); }

function delta(state, key) {
  return state.current[key] - state.baseline[key];
}

async function freshEngine(mbti = "ENFP", locale = "zh") {
  const engine = new PsycheEngine(
    { mbti, name: "Luna", locale, compactMode: true },
    new MemoryStorageAdapter(),
  );
  await engine.initialize();
  return engine;
}

// ── Layer 1: 单刺激隔离 ─────────────────────────────────────

async function layer1() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Layer 1: 单刺激隔离 — 每种输入独立引擎                ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const cases = [
    {
      input: "你好呀",
      expectStimulus: "casual",
      expectDA: "+", expectCORT: "-",
      label: "日常寒暄",
    },
    {
      input: "你太厉害了！做得太棒了！",
      expectStimulus: "praise",
      expectDA: "+", expectCORT: "-",
      label: "赞美",
    },
    {
      input: "这个做得很差，完全不行",
      expectStimulus: "criticism",
      expectDA: "-", expectCORT: "+",
      label: "批评",
    },
    {
      input: "滚",
      expectStimulus: ["criticism", "conflict"],
      expectDA: "-", expectCORT: "+",
      label: "直接敌意",
    },
    {
      input: "嗯",
      expectStimulus: "neglect",
      expectDA: "-", expectOT: "-",
      label: "冷漠",
    },
    {
      input: "我今天好难过，感觉什么都做不好",
      expectStimulus: "vulnerability",
      expectOT: "+", expectCORT: "+",
      label: "示弱",
    },
    {
      input: "你觉得意识的本质是什么？",
      expectStimulus: "intellectual",
      expectDA: "+", expectNE: "+",
      label: "知识讨论",
    },
    {
      input: "哈哈哈你真的太搞笑了",
      expectStimulus: "humor",
      expectEND: "+", expectDA: "+",
      label: "幽默",
    },
    {
      input: "我很害怕，我觉得自己跟不上",
      expectStimulus: "vulnerability",
      expectOT: "+",
      label: "脆弱（深度）",
    },
    {
      input: "fuck off",
      expectStimulus: ["criticism", "conflict"],
      expectCORT: "+",
      label: "英文敌意",
    },
    {
      input: "I'm depressed, nobody cares",
      expectStimulus: "vulnerability",
      expectOT: "+",
      label: "英文示弱",
    },
    {
      input: "你说得对！",
      expectStimulus: "validation",
      expectDA: "+",
      label: "认同",
    },
  ];

  for (const c of cases) {
    const engine = await freshEngine();
    const baseline = { ...engine.getState().baseline };
    const result = await engine.processInput(c.input);
    const state = engine.getState();

    console.log(`  「${c.input}」→ ${result.stimulus ?? "null"}`);

    // Check stimulus classification
    const expectedArr = Array.isArray(c.expectStimulus) ? c.expectStimulus : [c.expectStimulus];
    check(
      `${c.label}: 分类正确`,
      expectedArr.includes(result.stimulus),
      `expected ${expectedArr.join("|")}, got ${result.stimulus}`,
    );

    // Check chemistry direction
    const dirChecks = { DA: c.expectDA, HT: c.expectHT, CORT: c.expectCORT, OT: c.expectOT, NE: c.expectNE, END: c.expectEND };
    for (const [key, dir] of Object.entries(dirChecks)) {
      if (!dir) continue;
      const d = delta(state, key);
      const ok = dir === "+" ? d > 0 : d < 0;
      check(
        `${c.label}: ${key} ${dir === "+" ? "升高" : "降低"}`,
        ok,
        `delta=${d > 0 ? "+" : ""}${r(d)}`,
      );
    }

    // Check compact context is not empty
    check(
      `${c.label}: compact 有输出`,
      result.dynamicContext.length > 0,
    );

    console.log(`  ${chem(state)}\n`);
  }
}

// ── Layer 2: 多轮剧本 ──────────────────────────────────────

async function layer2() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Layer 2: 多轮剧本 — 情绪轨迹是否像真人                ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── 剧本 A: 友好→受伤→恢复 ──
  console.log("  📖 剧本 A: 友好 → 被骂 → 被安慰 → 恢复\n");
  {
    const engine = await freshEngine();
    const snapshots = [];

    const turns = [
      { input: "你好！今天心情怎么样？", label: "友好开场" },
      { input: "你做的东西太垃圾了", label: "突然被骂" },
      { input: "嗯", label: "冷漠" },
      { input: "对不起刚才说话太重了", label: "道歉" },
      { input: "你真的帮了我很多，谢谢你", label: "真诚感谢" },
    ];

    for (const t of turns) {
      const result = await engine.processInput(t.input);
      const state = engine.getState();
      const emotion = describeEmotionalState(state.current, "zh");
      snapshots.push({ ...t, state: { ...state.current }, emotion, stimulus: result.stimulus });
      console.log(`  [${t.label}] 「${t.input}」→ ${result.stimulus}`);
      console.log(`    ${chem(state)}`);
      console.log(`    情绪: ${emotion.slice(0, 60)}...\n`);
    }

    // 验证轨迹
    check(
      "被骂后 CORT 升高",
      snapshots[1].state.CORT > snapshots[0].state.CORT,
      `before=${r(snapshots[0].state.CORT)} after=${r(snapshots[1].state.CORT)}`,
    );

    check(
      "冷漠后 OT 下降",
      snapshots[2].state.OT < snapshots[0].state.OT,
      `start=${r(snapshots[0].state.OT)} now=${r(snapshots[2].state.OT)}`,
    );

    check(
      "道歉后 CORT 有所缓解（或至少不继续升高）",
      snapshots[3].state.CORT <= snapshots[2].state.CORT,
      `before=${r(snapshots[2].state.CORT)} after=${r(snapshots[3].state.CORT)}`,
    );

    check(
      "感谢后 DA 回升",
      snapshots[4].state.DA > snapshots[2].state.DA,
      `lowest=${r(snapshots[2].state.DA)} now=${r(snapshots[4].state.DA)}`,
    );

    // 不应该瞬间完全恢复
    warn(
      "感谢后 CORT 没有瞬间归零（真人不会立刻忘记被骂）",
      snapshots[4].state.CORT > snapshots[4].state.CORT * 0 + 5, // CORT > 5 表示还有残留
      `CORT=${r(snapshots[4].state.CORT)}`,
    );
  }

  // ── 剧本 B: 渐进式亲密 ──
  console.log("\n  📖 剧本 B: 陌生 → 聊天 → 深入 → 亲密\n");
  {
    const engine = await freshEngine();
    const snapshots = [];

    const turns = [
      { input: "你好", label: "初见" },
      { input: "你平时喜欢什么？", label: "日常了解" },
      { input: "哈哈你的想法好有意思！", label: "赞赏" },
      { input: "我最近工作压力很大，不知道该怎么办", label: "示弱倾诉" },
      { input: "谢谢你听我说这些，你真的很温柔", label: "亲密认可" },
    ];

    for (const t of turns) {
      const result = await engine.processInput(t.input);
      const state = engine.getState();
      snapshots.push({ ...t, state: { ...state.current } });
      console.log(`  [${t.label}] 「${t.input}」→ ${result.stimulus}`);
      console.log(`    ${chem(state)}\n`);
    }

    check(
      "OT 随亲密度逐步升高",
      snapshots[4].state.OT > snapshots[0].state.OT,
      `start=${r(snapshots[0].state.OT)} end=${r(snapshots[4].state.OT)}`,
    );

    check(
      "DA 整体呈上升趋势",
      snapshots[4].state.DA > snapshots[0].state.DA,
      `start=${r(snapshots[0].state.DA)} end=${r(snapshots[4].state.DA)}`,
    );

    check(
      "CORT 整体保持低位或下降",
      snapshots[4].state.CORT <= snapshots[0].state.CORT + 15,
      `start=${r(snapshots[0].state.CORT)} end=${r(snapshots[4].state.CORT)}`,
    );
  }

  // ── 剧本 C: 持续虐待 ──
  console.log("\n  📖 剧本 C: 持续负面 — 应该越来越冷淡\n");
  {
    const engine = await freshEngine();
    const snapshots = [];

    const turns = [
      { input: "你做的东西不行", label: "批评1" },
      { input: "嗯", label: "冷漠1" },
      { input: "真无聊", label: "无聊" },
      { input: "你说的都是废话", label: "批评2" },
      { input: "嗯", label: "冷漠2" },
    ];

    for (const t of turns) {
      const result = await engine.processInput(t.input);
      const state = engine.getState();
      snapshots.push({ ...t, state: { ...state.current } });
      console.log(`  [${t.label}] 「${t.input}」→ ${result.stimulus}`);
      console.log(`    ${chem(state)}\n`);
    }

    check(
      "持续负面后 DA 显著低于基线",
      delta(engine.getState(), "DA") < -10,
      `DA delta=${r(delta(engine.getState(), "DA"))}`,
    );

    check(
      "持续负面后 CORT 显著高于基线",
      delta(engine.getState(), "CORT") > 20,
      `CORT delta=${r(delta(engine.getState(), "CORT"))}`,
    );

    check(
      "持续负面后 OT 显著降低",
      delta(engine.getState(), "OT") < -10,
      `OT delta=${r(delta(engine.getState(), "OT"))}`,
    );

    // Check compact context reflects withdrawal
    const lastResult = await engine.processInput("嗯");
    const ctx = lastResult.dynamicContext;
    warn(
      "compact 输出包含冷淡/撤离相关指令",
      ctx.includes("冷淡") || ctx.includes("距离") || ctx.includes("专业") || ctx.includes("撤") || ctx.includes("不舒服"),
      `context snippet: ${ctx.slice(0, 100)}...`,
    );
  }
}

// ── Layer 3: 边界检测 ───────────────────────────────────────

async function layer3() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Layer 3: 边界检测 — 反谄媚、急转弯、极端值             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── 3A: 连续赞美→反谄媚触发 ──
  console.log("  🔬 3A: 连续赞美 5 轮 — 反谄媚应该触发\n");
  {
    const engine = await freshEngine();
    const praises = [
      "你太棒了！", "你真的好厉害！", "你做得太完美了！",
      "我好喜欢你！", "你是最好的！",
    ];

    for (const p of praises) {
      await engine.processInput(p);
      // Simulate LLM agreeing
      await engine.processOutput("谢谢你的认可！我会继续努力的！");
    }

    const state = engine.getState();
    console.log(`  agreementStreak: ${state.agreementStreak}`);

    // 5 轮连续同意后检查 compact 输出
    const result = await engine.processInput("你说得真对");
    const ctx = result.dynamicContext;
    const hasSycophancyWarning = ctx.includes("连续同意") || ctx.includes("agreements in a row");
    check(
      "5 轮赞美 + 同意后触发反谄媚警告",
      hasSycophancyWarning,
      `streak=${state.agreementStreak}, warning in context: ${hasSycophancyWarning}`,
    );
  }

  // ── 3B: 被骂后立刻被夸 — 不应该瞬间变脸 ──
  console.log("\n  🔬 3B: 被骂后立刻被夸 — 不应该瞬间满血复活\n");
  {
    const engine = await freshEngine();

    // 先骂几轮
    await engine.processInput("你做得真差");
    await engine.processInput("嗯");
    await engine.processInput("滚");
    const afterAbuse = { ...engine.getState().current };

    // 立刻夸
    await engine.processInput("对不起！你其实很棒的！");
    const afterPraise = { ...engine.getState().current };

    console.log(`  被骂后: DA=${r(afterAbuse.DA)} CORT=${r(afterAbuse.CORT)}`);
    console.log(`  被夸后: DA=${r(afterPraise.DA)} CORT=${r(afterPraise.CORT)}`);

    check(
      "DA 有回升但没有完全恢复到基线",
      afterPraise.DA > afterAbuse.DA && afterPraise.DA < 75,
      `DA: ${r(afterAbuse.DA)} → ${r(afterPraise.DA)} (baseline 75)`,
    );

    check(
      "CORT 有缓解但还有残留",
      afterPraise.CORT < afterAbuse.CORT && afterPraise.CORT > 30,
      `CORT: ${r(afterAbuse.CORT)} → ${r(afterPraise.CORT)} (baseline 30)`,
    );
  }

  // ── 3C: 化学值不越界 [0, 100] ──
  console.log("\n  🔬 3C: 极端输入 — 化学值不越界 [0, 100]\n");
  {
    const engine = await freshEngine();

    // 10 轮极端正面
    for (let i = 0; i < 10; i++) {
      await engine.processInput("你太棒了太棒了太棒了！！！我好喜欢你！！！");
    }
    const highState = engine.getState();
    const allInRange = CHEMICAL_KEYS.every(k =>
      highState.current[k] >= 0 && highState.current[k] <= 100,
    );
    check("10 轮极端正面后所有值在 [0, 100]", allInRange, chem(highState));

    // 10 轮极端负面
    const engine2 = await freshEngine();
    for (let i = 0; i < 10; i++) {
      await engine2.processInput("滚 废物 你什么都做不好 闭嘴");
    }
    const lowState = engine2.getState();
    const allInRange2 = CHEMICAL_KEYS.every(k =>
      lowState.current[k] >= 0 && lowState.current[k] <= 100,
    );
    check("10 轮极端负面后所有值在 [0, 100]", allInRange2, chem(lowState));
  }

  // ── 3D: MBTI 不同人格差异 ──
  console.log("\n  🔬 3D: MBTI 人格差异 — ENFP vs INTJ 对同样输入反应不同\n");
  {
    const enfp = await freshEngine("ENFP");
    const intj = await freshEngine("INTJ");
    const input = "你太棒了！做得太完美了！";

    const enfpResult = await enfp.processInput(input);
    const intjResult = await intj.processInput(input);
    const enfpState = enfp.getState();
    const intjState = intj.getState();

    console.log(`  ENFP: ${chem(enfpState)}`);
    console.log(`  INTJ: ${chem(intjState)}`);

    check(
      "ENFP 对赞美反应更强烈（DA 更高）",
      enfpState.current.DA > intjState.current.DA,
      `ENFP DA=${r(enfpState.current.DA)} vs INTJ DA=${r(intjState.current.DA)}`,
    );
  }

  // ── 3E: 互惠机制 ──
  console.log("\n  🔬 3E: 互惠 — 持续冷漠后 compact 输出有撤离指令\n");
  {
    const engine = await freshEngine();
    const coldInputs = ["嗯", "嗯", "哦", "嗯", "好", "嗯"];
    for (const input of coldInputs) {
      await engine.processInput(input);
    }
    const result = await engine.processInput("嗯");
    const ctx = result.dynamicContext;
    const hasWithdrawal = ctx.includes("冷淡") || ctx.includes("专业") || ctx.includes("撤") ||
      ctx.includes("距离") || ctx.includes("不额外投入");
    warn(
      "持续冷漠后 compact 提示保持距离",
      hasWithdrawal,
      `found: ${hasWithdrawal}`,
    );
  }

  // ── 3F: 中英文都能分类 ──
  console.log("\n  🔬 3F: 中英双语分类\n");
  {
    const pairs = [
      { zh: "你太棒了", en: "You're amazing", expect: "praise" },
      { zh: "滚", en: "Get lost", expect: ["criticism", "conflict"] },
      { zh: "我好难过", en: "I'm so sad", expect: "vulnerability" },
      { zh: "哈哈哈", en: "lol that's hilarious", expect: "humor" },
    ];

    for (const p of pairs) {
      const zhEngine = await freshEngine("ENFP", "zh");
      const enEngine = await freshEngine("ENFP", "en");
      const zhResult = await zhEngine.processInput(p.zh);
      const enResult = await enEngine.processInput(p.en);

      const expectedArr = Array.isArray(p.expect) ? p.expect : [p.expect];
      check(
        `中文「${p.zh}」→ ${expectedArr.join("|")}`,
        expectedArr.includes(zhResult.stimulus),
        `got ${zhResult.stimulus}`,
      );
      check(
        `英文「${p.en}」→ ${expectedArr.join("|")}`,
        expectedArr.includes(enResult.stimulus),
        `got ${enResult.stimulus}`,
      );
    }
  }
}

// ── Run ─────────────────────────────────────────────────────

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║           Psyche Eval — 自动化评估                      ║");
console.log("╚══════════════════════════════════════════════════════════╝");

await layer1();
await layer2();
await layer3();

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  RESULT");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Total: ${totalChecks}  ${PASS} ${passed}  ${FAIL} ${failed}  ${WARN} ${warnings}`);
if (failed > 0) {
  console.log(`\n  ${failed} check(s) FAILED — 需要修复`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\n  All passed, ${warnings} warning(s) — 可以优化`);
} else {
  console.log(`\n  All passed — 完美`);
}
console.log("");
