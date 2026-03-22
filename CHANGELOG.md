# 更新日志 / Changelog

## v0.2.1 — 闭环情感 / Closed-Loop Emotions

### 闭环刺激分类 / Closed-Loop Stimulus Classification

- **刺激分类器** (`src/classify.ts`): 在 LLM 处理前，通过正则模式匹配自动分类用户输入的刺激类型（14 种），支持中英文。分类结果用于预计算化学变化，LLM 收到的 prompt 已反映情绪变化。
- **Stimulus classifier** (`src/classify.ts`): Auto-classifies user input into 14 stimulus types via regex pattern matching before the LLM processes it. Supports both Chinese and English. Classification is used to pre-compute chemistry changes.

### 情绪记忆 / Emotional Memory

- **化学快照** (`ChemicalSnapshot`): 每轮对话记录化学状态、刺激类型、主导情绪，最多保留 10 轮。
- **情绪轨迹**: 动态上下文中展示最近几轮的化学趋势（如 "多巴胺↑ 皮质醇↓"），让 LLM 感知情绪变化方向。
- **Chemical snapshots** (`ChemicalSnapshot`): Each turn records chemistry, stimulus type, dominant emotion. Keeps last 10 entries.
- **Emotional trajectory**: Dynamic context shows recent chemical trends, giving the LLM awareness of emotional direction.

### 行为约束 / Behavioral Constraints

- 化学状态机械性约束输出格式，不依赖 LLM 自觉遵守：
  - CORT > 60 → 最多 3 句话
  - DA < 35 → 不主动发起话题
  - HT < 35 → 用词更尖锐
  - OT > 75 → 像朋友一样说话
  - NE > 75 → 语速快、跳跃
  - END > 75 → 轻松、可以开玩笑
- Chemistry mechanically constrains output format, not relying on LLM compliance.

### 互惠机制 / Reciprocity System

- 根据用户最近 5 轮的刺激类型计算投入分数。
- 高投入 (>1): agent 更温暖、更主动。
- 低投入 (-0.5 ~ -1.5): agent 减少闲聊，但问什么答什么。
- 持续冷漠 (<-1.5): 纯专业模式，情感完全撤出。
- **底线**: 无论对方态度如何，专业能力永不打折。
- Computes user investment score from recent 5 turns. Agent adjusts emotional engagement accordingly. Floor rule: competence never drops.

### 工程 / Engineering

- **测试**: 236 个测试，6 个文件（新增 classify.test.ts），0 失败
- **Tests**: 236 tests across 6 files (added classify.test.ts), 0 failures

## v0.2.0 — 预发布加固 / Pre-release Hardening

### 工程 / Engineering

- **测试套件**: 191 个测试，5 个文件（chemistry, profiles, psyche-file, prompt, cli），使用 Node.js 内置测试运行器。零外部依赖。
- **类型安全**: 消除所有 `any` 类型。在 `src/guards.ts` 中添加类型守卫。
- **错误处理**: 区分文件不存在和权限错误。JSON 解析错误恢复。
- **原子写入**: `saveState()` 先写 `.tmp` 再重命名，防止崩溃时损坏。

### 模型完整性 / Model Completeness

- **5 种新刺激类型**: 讽刺、命令、被认同、无聊、示弱
- **5 种新情绪模式**: 怨恨、无聊、自信、羞耻、怀念
- **行为指导**: 每种情绪模式现在包含 `behaviorGuide` 字符串
- **情绪传染**: `applyContagion()` 实现
- **反媚俗**: `agreementStreak` 追踪

### Prompt 有效性 / Prompt Effectiveness

- **命令式协议**: 替换描述式协议为逐步指令
- **动态行为指令**: 检测到情绪时注入具体的行为指导
- **解析器加固**: 支持小数、中文化学名、英文全名

### 多用户 & 国际化 / Multi-user & i18n

- **多用户关系**: `relationships: Record<string, RelationshipState>`
- **i18n 框架**: `src/i18n.ts`，支持中/英

### 开源 / Open Source

- MIT 许可证
- `ARCHITECTURE.md`, `CONTRIBUTING.md`

### 状态迁移 / State Migration

- 自动 v1→v2 迁移

## v0.1.0 — 概念验证 / Concept Proof

三大支柱初始实现（虚拟内分泌、共情引擎、主体性）。9 种刺激类型，9 种情绪模式，16 种 MBTI 人格，CLI 工具，OpenClaw 插件集成。

Initial implementation with three pillars (virtual endocrine, empathy engine, agency). 9 stimulus types, 9 emotion patterns, 16 MBTI profiles, CLI tool, OpenClaw plugin integration.
