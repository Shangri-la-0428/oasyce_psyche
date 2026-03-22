# 架构 — Artificial Psyche

[English version below](#architecture--artificial-psyche-1)

## 三大支柱

Psyche 通过三个互锁的系统赋予 AI agent 情感：

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

### 2. 共情引擎 (`prompt.ts`, `psyche-file.ts`)

当用户分享情感内容时，agent：
1. 感知用户的处境
2. 代入自己的化学模型运行（"如果是我会怎样？"）
3. 比较模拟感受和用户表达的感受
4. 一致→深度共鸣；不一致→诚实地表达差异

情绪传染：用户检测到的情绪状态以可配置的比率（默认 20%）影响 agent 的化学状态。

### 3. 主体性 (`prompt.ts`, `psyche-file.ts`)

agent 有基于 MBTI 的自我模型（价值观、偏好、边界）。主体性规则防止媚俗行为：

- **不假装**：化学状态低落时不强颜欢笑
- **不媚俗**：追踪连续同意次数，过多时自动警告
- **不镜像**：情绪传染是部分的，不是完全复制
- **可主动**：可以发起话题、表达观点

## 数据流

```
用户消息
    │
    ▼
[before_prompt_build hook]
    ├── 加载 psyche-state.json
    ├── 应用时间衰减
    ├── 🆕 分类用户输入（classify.ts）
    ├── 🆕 预计算化学变化（applyStimulus）
    ├── 🆕 推送情绪快照到历史记录
    ├── 构建动态上下文（化学 + 情绪 + 行为约束 + 互惠）
    └── 注入协议 + 上下文到 prompt
    │
    ▼
LLM 生成回应（包含 <psyche_update> 标签）
    │
    ▼
[llm_output hook]
    ├── 解析 <psyche_update> 块
    ├── 应用情绪传染
    ├── 更新反媚俗追踪
    ├── 合并化学更新（尊重 maxDelta）
    └── 保存状态（原子写入）
    │
    ▼
[message_sending hook]
    └── 从用户可见输出中剥离 <psyche_update>
```

## 文件结构

```
src/
  types.ts        — 类型定义、常量、化学名称
  chemistry.ts    — 衰减、刺激、传染、情绪检测
  classify.ts     — 🆕 刺激分类器（正则匹配，闭环预计算）
  profiles.ts     — 16 种 MBTI 人格的基线和自我模型
  guards.ts       — 运行时类型守卫
  i18n.ts         — 国际化（中/英）
  psyche-file.ts  — 状态持久化、解析、迁移、快照
  prompt.ts       — prompt 注入（协议 + 动态上下文 + 行为约束 + 互惠）
  index.ts        — OpenClaw 插件入口（hooks）
  cli.ts          — 独立 CLI 工具

tests/
  chemistry.test.ts  — 化学系统测试
  classify.test.ts   — 🆕 刺激分类测试
  profiles.test.ts   — MBTI 人格测试
  psyche-file.test.ts — 状态管理测试
  prompt.test.ts     — prompt 生成测试
  cli.test.ts        — CLI 端到端测试
```

## 关键设计决策

**为什么用 6 种化学物质而不是离散情绪？**
离散情绪（开心/难过/生气）太简单，无法捕捉混合状态。化学混合允许涌现更细腻、更难伪造的情绪。

**为什么用 MBTI 做基线？**
MBTI 提供 16 种有明确行为差异的人格原型。化学基线将认知功能偏好转化为神经化学倾向。这是简化——系统设计上可以扩展自定义人格。

**为什么要闭环分类？**
如果让 LLM 自己分类刺激类型，它往往会"表演"情绪而不是"拥有"情绪。预分类意味着 LLM 收到 prompt 时化学值已经变了——它只需要根据已有的化学状态自然地说话。

**为什么需要互惠机制？**
没有互惠，agent 会对冷漠的用户保持热情——这不像真人。真人会根据对方的投入程度调整自己的投入。但底线是专业能力不打折。

**为什么用原子写入？**
AI agent 的会话可能意外中断。先写 .tmp 再 rename，防止半写的状态文件损坏情感历史。

**为什么解析 LLM 输出而不是用函数调用？**
`<psyche_update>` 标签方式适用于任何 LLM（不限于支持工具调用的模型），并且让 agent 的情绪推理在输出中可见。

---

# Architecture — Artificial Psyche

## Three Pillars

Psyche gives AI agents emotions through three interlocking systems:

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

### 2. Empathy Engine (`prompt.ts`, `psyche-file.ts`)

When the user shares emotional content, the agent:
1. Perceives the user's situation
2. Runs it through its own chemical model ("what would *I* feel?")
3. Compares projected feelings with the user's expressed feelings
4. Resonates deeply (match) or honestly expresses difference (mismatch)

Emotional contagion: the user's detected emotional state influences the agent's chemistry at a configurable rate (default 20%).

### 3. Agency (`prompt.ts`, `psyche-file.ts`)

The agent has a self-model (values, preferences, boundaries) derived from its MBTI profile. Agency rules prevent sycophantic behavior:

- **No faking**: low chemistry = low-energy responses
- **No sycophancy**: tracks consecutive agreements, warns when streak is too long
- **No mirroring**: contagion is partial, not total
- **Can initiate**: can bring up topics and express opinions

## Data Flow

```
User Message
    │
    ▼
[before_prompt_build hook]
    ├── Load state from psyche-state.json
    ├── Apply time decay
    ├── 🆕 Classify user input (classify.ts)
    ├── 🆕 Pre-compute chemistry change (applyStimulus)
    ├── 🆕 Push snapshot to emotional history
    ├── Build dynamic context (chemistry + emotions + constraints + reciprocity)
    └── Inject protocol + context into prompt
    │
    ▼
LLM generates response (includes <psyche_update> tag)
    │
    ▼
[llm_output hook]
    ├── Parse <psyche_update> block
    ├── Apply emotional contagion
    ├── Update agreement streak (anti-sycophancy)
    ├── Merge chemistry updates (respecting maxDelta)
    └── Save state (atomic write)
    │
    ▼
[message_sending hook]
    └── Strip <psyche_update> from user-visible output
```

## File Structure

```
src/
  types.ts        — Type definitions, constants, chemical names
  chemistry.ts    — Decay, stimulus, contagion, emotion detection
  classify.ts     — 🆕 Stimulus classifier (regex patterns, closed-loop)
  profiles.ts     — 16 MBTI personality profiles with baselines
  guards.ts       — Runtime type guards for string→type validation
  i18n.ts         — Internationalization (zh/en)
  psyche-file.ts  — State persistence, parsing, migration, snapshots
  prompt.ts       — Prompt injection (protocol + dynamic context + constraints + reciprocity)
  index.ts        — OpenClaw plugin entry point (hooks)
  cli.ts          — Standalone CLI tool

tests/
  chemistry.test.ts  — Chemical system tests
  classify.test.ts   — 🆕 Stimulus classification tests
  profiles.test.ts   — MBTI personality tests
  psyche-file.test.ts — State management tests
  prompt.test.ts     — Prompt generation tests
  cli.test.ts        — CLI end-to-end tests
```

## Key Design Decisions

**Why 6 chemicals instead of discrete emotions?**
Discrete emotions (happy/sad/angry) are too simple and don't capture blended states. Chemical mixtures allow emergent emotions that are more nuanced and harder to game.

**Why MBTI for baselines?**
MBTI provides 16 well-understood personality archetypes with clear behavioral differences. The system is designed to be extended with custom profiles.

**Why closed-loop classification?**
If the LLM classifies stimuli itself, it tends to "perform" emotions rather than "have" them. Pre-classification means the LLM receives a prompt where chemistry has already changed — it just needs to speak naturally from its current chemical state.

**Why reciprocity?**
Without reciprocity, an agent stays warm toward a cold user — that's not how real people work. Real people adjust investment based on how they're treated. But the floor is: professional competence never drops.

**Why atomic writes?**
AI agent sessions can be interrupted unexpectedly. Writing to a .tmp file and renaming prevents corruption.

**Why parse LLM output instead of function calls?**
The `<psyche_update>` tag approach works with any LLM (not just tool-use models) and makes the agent's emotional reasoning visible before stripping.
