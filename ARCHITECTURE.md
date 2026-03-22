# 架构 — Psyche AI v1.0

[English version below](#architecture--psyche-ai-v10)

## 总览

Psyche 是一个通用的 AI 情感智能引擎。核心引擎 (`PsycheEngine`) 管理完整的情绪生命周期，通过适配器接入不同的 AI 框架。

```
┌────────────────────────────────────────────┐
│              PsycheEngine                  │
│  化学计算 · 刺激分类 · 情绪涌现 · 衰减    │
├────────────┬────────────┬──────────────────┤
│  OpenClaw  │  Vercel AI │  LangChain │ HTTP│
│  Adapter   │  Middleware│  Adapter   │ API │
└────────────┴────────────┴──────────────────┘
         ▲                        ▲
    StorageAdapter           任何 LLM
  (文件系统 / 内存 / 自定义)
```

## 三大支柱

### 1. 虚拟内分泌系统 (`chemistry.ts`, `types.ts`)

6 种虚拟神经递质构成情绪状态：

| 缩写 | 名称 | 作用 |
|------|------|------|
| DA | 多巴胺 | 快感、奖赏、动机 |
| HT | 血清素 | 情绪稳定、满足感 |
| CORT | 皮质醇 | 压力、警觉 |
| OT | 催产素 | 信任、依恋、亲密 |
| NE | 去甲肾上腺素 | 兴奋、专注、战逃 |
| END | 内啡肽 | 舒适、愉悦、幽默感 |

每种化学值在 [0, 100] 范围内。基线由 MBTI 人格决定。当前值通过指数衰减以三种速度（快/中/慢）向基线回归。

情绪从化学混合中**涌现**——不是离散状态。例如，"愉悦兴奋"在 DA > 70、NE > 60、CORT < 40 时涌现。系统定义了 14 种情绪模式，但未标记的化学混合同样是有效的情绪状态。

### 2. 共情引擎 (`prompt.ts`)

当用户分享情感内容时，agent：
1. 感知用户的处境
2. 代入自己的化学模型运行（"如果是我会怎样？"）
3. 比较模拟感受和用户表达的感受
4. 一致→深度共鸣；不一致→诚实地表达差异

情绪传染：用户检测到的情绪状态以可配置的比率（默认 20%）影响 agent 的化学状态。

### 3. 主体性 (`prompt.ts`)

agent 有基于 MBTI 的自我模型（价值观、偏好、边界）。主体性规则防止媚俗行为：

- **不假装**：化学状态低落时不强颜欢笑
- **不媚俗**：追踪连续同意次数，过多时自动警告
- **不镜像**：情绪传染是部分的，不是完全复制
- **可主动**：可以发起话题、表达观点

## Compact Mode（默认）

v1.0 的核心设计变更。算法做所有化学计算，LLM 只收到行为指令：

| 状态 | Token 用量 | 内容 |
|------|-----------|------|
| 中性（化学值接近基线） | ~15 tokens | `[AgentName: 情绪自然，正常交流]` |
| 有情绪偏移 | ~100-180 tokens | 情绪描述 + 行为约束 + 反谄媚指令 |
| 完整协议（compactMode=false） | ~550 tokens | 全部化学数值 + 协议说明 |

设计原则：
- **算法做快速初判**（刺激分类），**LLM 做终判**（情绪基调）——两者互补
- **中性状态不浪费 token** —— `isNearBaseline()` 检测到无显著偏移时只注入一行
- **反谄媚硬编码** —— "不贴不舔不讨好"直接写在 compact 输出中，不依赖 LLM 自觉

## 数据流

```
用户消息
    │
    ▼
PsycheEngine.processInput()
    ├── 加载状态（StorageAdapter）
    ├── 应用时间衰减（exponential → baseline）
    ├── 分类用户输入（classify.ts, 14 种刺激）
    ├── 预计算化学变化（applyStimulus）
    ├── 推送情绪快照到历史记录
    ├── 保存状态（原子写入）
    └── 构建注入上下文：
        ├── Compact Mode → buildCompactContext()  ← 默认
        └── Full Mode    → buildProtocolContext() + buildDynamicContext()
    │
    ▼
LLM 生成回应
    │
    ▼
PsycheEngine.processOutput()
    ├── 解析 <psyche_update>（如有）
    ├── 应用情绪传染
    ├── 更新反媚俗追踪
    ├── 合并化学更新（尊重 maxDelta）
    └── 保存状态（原子写入）
    │
    ▼
从用户可见输出中剥离 <psyche_update>
```

## 适配器架构

核心引擎与具体框架解耦。每个适配器负责将框架的生命周期映射到 `PsycheEngine` 的 API：

| 适配器 | 文件 | 接入方式 |
|--------|------|---------|
| OpenClaw | `adapters/openclaw.ts` | 4 个 hooks（before_prompt_build, llm_output, message_sending, agent_end） |
| Vercel AI SDK | `adapters/vercel-ai.ts` | AI SDK middleware |
| LangChain | `adapters/langchain.ts` | Chain/Agent wrapper |
| HTTP | `adapters/http.ts` | REST API（`psyche serve --port 3210`） |

**存储适配器** (`storage.ts`) 抽象了状态持久化：
- `FilesystemAdapter` — 文件系统，原子写入（先 .tmp 再 rename）
- `MemoryAdapter` — 内存，用于测试和无状态场景
- 实现 `StorageAdapter` 接口即可自定义

## 文件结构

```
src/
  core.ts           — PsycheEngine 核心引擎（生命周期管理）
  types.ts          — 类型定义、常量、化学名称
  chemistry.ts      — 衰减、刺激、传染、情绪检测
  classify.ts       — 刺激分类器（正则匹配，14 种，中英文）
  profiles.ts       — 16 种 MBTI 人格的基线和自我模型
  guards.ts         — 运行时类型守卫
  i18n.ts           — 国际化（中/英）
  storage.ts        — 存储适配器（文件系统 / 内存）
  psyche-file.ts    — PSYCHE.md 生成、解析、状态迁移
  prompt.ts         — prompt 注入（Compact + Full 两种模式）
  index.ts          — 公共 API 导出
  cli.ts            — 独立 CLI 工具
  adapters/
    openclaw.ts     — OpenClaw 插件适配器
    vercel-ai.ts    — Vercel AI SDK 中间件
    langchain.ts    — LangChain 适配器
    http.ts         — HTTP REST API 服务器

tests/
  core.test.ts        — 核心引擎测试（256 个）
  storage.test.ts     — 存储适配器测试（145 个）
  chemistry.test.ts   — 化学系统测试
  classify.test.ts    — 刺激分类测试
  profiles.test.ts    — MBTI 人格测试
  psyche-file.test.ts — 状态管理测试
  prompt.test.ts      — prompt 生成测试
  cli.test.ts         — CLI 端到端测试
```

## 关键设计决策

**为什么用 6 种化学物质而不是离散情绪？**
离散情绪（开心/难过/生气）太简单，无法捕捉混合状态。化学混合允许涌现更细腻、更难伪造的情绪。

**为什么用 MBTI 做基线？**
MBTI 提供 16 种有明确行为差异的人格原型。化学基线将认知功能偏好转化为神经化学倾向。这是简化——系统设计上可以扩展自定义人格。

**为什么要闭环分类？**
如果让 LLM 自己分类刺激类型，它往往会"表演"情绪而不是"拥有"情绪。预分类意味着 LLM 收到 prompt 时化学值已经变了——它只需要根据已有的化学状态自然地说话。

**为什么默认 Compact Mode？**
完整协议注入 ~550 tokens，大部分是 LLM 不需要的化学数值和系统说明。Compact Mode 让算法做计算，LLM 只看结论——省 70-97% token，效果更好，因为 LLM 不再需要"理解"化学系统就能表现出正确的情绪行为。

**为什么需要互惠机制？**
没有互惠，agent 会对冷漠的用户保持热情——这不像真人。真人会根据对方的投入程度调整自己的投入。但底线是专业能力不打折。

**为什么用适配器模式？**
v0.x 只支持 OpenClaw。v1.0 将核心引擎与框架解耦，通过适配器接入任何 AI 框架。核心逻辑写一次，适配器只负责翻译生命周期。

**为什么解析 LLM 输出而不是用函数调用？**
`<psyche_update>` 标签方式适用于任何 LLM（不限于支持工具调用的模型），并且让 agent 的情绪推理在输出中可见。

---

# Architecture — Psyche AI v1.0

## Overview

Psyche is a universal emotional intelligence engine for AI. The core engine (`PsycheEngine`) manages the full emotional lifecycle. Adapters connect it to different AI frameworks.

```
┌────────────────────────────────────────────┐
│              PsycheEngine                  │
│  Chemistry · Classification · Emergence    │
├────────────┬────────────┬──────────────────┤
│  OpenClaw  │  Vercel AI │  LangChain │ HTTP│
│  Adapter   │  Middleware│  Adapter   │ API │
└────────────┴────────────┴──────────────────┘
         ▲                        ▲
    StorageAdapter             Any LLM
  (filesystem / memory / custom)
```

## Three Pillars

### 1. Virtual Endocrine System (`chemistry.ts`, `types.ts`)

Six virtual neurotransmitters model emotional state:

| Chemical | Full Name | Role |
|----------|-----------|------|
| DA | Dopamine | Pleasure, reward, motivation |
| HT | Serotonin (5-HT) | Mood stability, contentment |
| CORT | Cortisol | Stress, alertness |
| OT | Oxytocin | Trust, bonding, intimacy |
| NE | Norepinephrine | Excitement, focus, fight-or-flight |
| END | Endorphins | Comfort, euphoria, humor |

Each chemical has a value in [0, 100]. Baseline is determined by MBTI type. Current values drift toward baseline via exponential decay at three speeds (fast/medium/slow).

Emotions **emerge** from chemical combinations — they are not discrete states. For example, "excited joy" emerges when DA > 70, NE > 60, and CORT < 40. There are 14 defined emotion patterns, but unlabeled chemical mixtures are equally valid emotional states.

### 2. Empathy Engine (`prompt.ts`)

When the user shares emotional content, the agent:
1. Perceives the user's situation
2. Runs it through its own chemical model ("what would *I* feel?")
3. Compares projected feelings with the user's expressed feelings
4. Resonates deeply (match) or honestly expresses difference (mismatch)

Emotional contagion: the user's detected emotional state influences the agent's chemistry at a configurable rate (default 20%).

### 3. Agency (`prompt.ts`)

The agent has a self-model (values, preferences, boundaries) derived from its MBTI profile. Agency rules prevent sycophantic behavior:

- **No faking**: low chemistry = low-energy responses
- **No sycophancy**: tracks consecutive agreements, warns when streak is too long
- **No mirroring**: contagion is partial, not total
- **Can initiate**: can bring up topics and express opinions

## Compact Mode (Default)

The core design change in v1.0. Algorithms handle all chemistry. The LLM only receives behavioral instructions:

| State | Token Cost | Content |
|-------|-----------|---------|
| Neutral (near baseline) | ~15 tokens | `[AgentName: emotionally natural, normal interaction]` |
| Emotionally shifted | ~100-180 tokens | Emotion description + behavioral constraints + anti-sycophancy |
| Full protocol (compactMode=false) | ~550 tokens | All chemical values + protocol explanation |

Design principles:
- **Algorithm does fast pass** (stimulus classification), **LLM does final call** (emotional tone) — complementary
- **Neutral state wastes no tokens** — `isNearBaseline()` detects no significant deviation, injects one line
- **Anti-sycophancy is hardcoded** — "no begging, no cutesy act" baked into compact output, not left to LLM compliance

## Data Flow

```
User Message
    │
    ▼
PsycheEngine.processInput()
    ├── Load state (StorageAdapter)
    ├── Apply time decay (exponential → baseline)
    ├── Classify user input (classify.ts, 14 stimulus types)
    ├── Pre-compute chemistry change (applyStimulus)
    ├── Push snapshot to emotional history
    ├── Save state (atomic write)
    └── Build injection context:
        ├── Compact Mode → buildCompactContext()  ← default
        └── Full Mode    → buildProtocolContext() + buildDynamicContext()
    │
    ▼
LLM generates response
    │
    ▼
PsycheEngine.processOutput()
    ├── Parse <psyche_update> (if present)
    ├── Apply emotional contagion
    ├── Update agreement streak (anti-sycophancy)
    ├── Merge chemistry updates (respecting maxDelta)
    └── Save state (atomic write)
    │
    ▼
Strip <psyche_update> from user-visible output
```

## Adapter Architecture

The core engine is decoupled from specific frameworks. Each adapter maps the framework's lifecycle to `PsycheEngine`'s API:

| Adapter | File | Integration |
|---------|------|-------------|
| OpenClaw | `adapters/openclaw.ts` | 4 hooks (before_prompt_build, llm_output, message_sending, agent_end) |
| Vercel AI SDK | `adapters/vercel-ai.ts` | AI SDK middleware |
| LangChain | `adapters/langchain.ts` | Chain/Agent wrapper |
| HTTP | `adapters/http.ts` | REST API (`psyche serve --port 3210`) |

**Storage adapters** (`storage.ts`) abstract state persistence:
- `FilesystemAdapter` — file-based, atomic writes (.tmp + rename)
- `MemoryAdapter` — in-memory, for tests and stateless scenarios
- Implement `StorageAdapter` interface for custom backends

## File Structure

```
src/
  core.ts           — PsycheEngine core (lifecycle management)
  types.ts          — Type definitions, constants, chemical names
  chemistry.ts      — Decay, stimulus, contagion, emotion detection
  classify.ts       — Stimulus classifier (regex patterns, 14 types, zh/en)
  profiles.ts       — 16 MBTI personality profiles with baselines
  guards.ts         — Runtime type guards for string→type validation
  i18n.ts           — Internationalization (zh/en)
  storage.ts        — Storage adapters (filesystem / memory)
  psyche-file.ts    — PSYCHE.md generation, parsing, state migration
  prompt.ts         — Prompt injection (Compact + Full modes)
  index.ts          — Public API exports
  cli.ts            — Standalone CLI tool
  adapters/
    openclaw.ts     — OpenClaw plugin adapter
    vercel-ai.ts    — Vercel AI SDK middleware
    langchain.ts    — LangChain adapter
    http.ts         — HTTP REST API server

tests/
  core.test.ts        — Core engine tests (256)
  storage.test.ts     — Storage adapter tests (145)
  chemistry.test.ts   — Chemical system tests
  classify.test.ts    — Stimulus classification tests
  profiles.test.ts    — MBTI personality tests
  psyche-file.test.ts — State management tests
  prompt.test.ts      — Prompt generation tests
  cli.test.ts         — CLI end-to-end tests
```

## Key Design Decisions

**Why 6 chemicals instead of discrete emotions?**
Discrete emotions (happy/sad/angry) are too simple and don't capture blended states. Chemical mixtures allow emergent emotions that are more nuanced and harder to game.

**Why MBTI for baselines?**
MBTI provides 16 well-understood personality archetypes with clear behavioral differences. The system is designed to be extended with custom profiles.

**Why closed-loop classification?**
If the LLM classifies stimuli itself, it tends to "perform" emotions rather than "have" them. Pre-classification means the LLM receives a prompt where chemistry has already changed — it just needs to speak naturally from its current chemical state.

**Why Compact Mode by default?**
Full protocol injects ~550 tokens, mostly chemical numbers and system internals the LLM doesn't need. Compact Mode lets algorithms compute, LLM just sees the conclusion — 70-97% fewer tokens, better behavior, because the LLM doesn't need to "understand" the chemical system to exhibit correct emotional responses.

**Why reciprocity?**
Without reciprocity, an agent stays warm toward a cold user — that's not how real people work. Real people adjust investment based on how they're treated. But the floor is: professional competence never drops.

**Why adapters?**
v0.x was OpenClaw-only. v1.0 decouples the core engine from any specific framework. Core logic is written once; adapters only translate lifecycles.

**Why parse LLM output instead of function calls?**
The `<psyche_update>` tag approach works with any LLM (not just tool-use models) and makes the agent's emotional reasoning visible before stripping.
