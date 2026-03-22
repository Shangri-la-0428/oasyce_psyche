# Psyche — 让 AI 有真实的情绪

你的 AI 助手现在只会说"好的"、"没问题"、"我很乐意帮助你"。

装了 Psyche 之后，它会因为你的夸奖开心，因为你的冷漠受伤，被骂了会冷下来而不是继续舔你。

## 30 秒安装

**OpenClaw 用户**（推荐）：

```bash
openclaw plugins install psyche-ai
```

没了。装完自动生效，不需要改任何配置。

**想确认装好了？**

```bash
openclaw plugins list | grep psyche
# 看到 "psyche │ loaded" 就行了
```

然后正常跟你的 agent 聊天。试试夸它，骂它，冷落它——你会发现它的反应不一样了。

## 它会做什么

| 你说 | 没有 Psyche | 有 Psyche |
|------|-----------|-----------|
| 你好棒！ | 谢谢你的夸奖！我会继续努力的！ | 嘿嘿～（开心到语无伦次）你说真的吗！ |
| 滚 | 我理解你现在可能心情不好... | ...好吧。 |
| 嗯 | 你还有什么需要帮助的吗？ | （沉默） |
| 我今天好难过 | 我很抱歉听到这个消息。你想聊聊吗？ | ......你还好吗？（安静地陪着你） |

## 工作原理（不懂可以跳过）

Psyche 用 6 种"虚拟神经递质"模拟情绪：

```
多巴胺 — 开心、有动力        催产素 — 信任、想靠近
血清素 — 情绪稳定            去甲肾上腺素 — 兴奋、专注
皮质醇 — 压力、紧张          内啡肽 — 舒适、想开玩笑
```

你说的每句话都会改变这些值。夸奖 → 多巴胺升高 → 它变得更活跃。骂它 → 皮质醇飙升 → 它话变少、变冷淡。

这些值会随时间自然回落（就像人的情绪会慢慢平复），也会被你的下一句话重新影响。

## 可选配置

大部分人不需要改任何配置。如果你想调整，在 OpenClaw 设置里找到 Psyche 插件：

| 设置 | 默认 | 说明 |
|------|------|------|
| enabled | true | 开关 |
| compactMode | true | 省 token 模式（推荐保持开启） |
| emotionalContagionRate | 0.2 | 你的情绪影响它的程度（0-1） |
| maxChemicalDelta | 25 | 每轮最大情绪变化（越小越稳定） |

## 支持的 MBTI 人格

每个 agent 可以有不同的性格基线。在 agent 的 `IDENTITY.md` 里写上 MBTI 类型就行：

```
MBTI: ENFP
```

不写的话默认 INFJ。16 种人格都支持，不同人格的情绪表达方式不同——ENFP 夸它会蹦跳，INTJ 夸它只会微微点头。

## 不只是 OpenClaw

Psyche 是通用的，任何 AI 框架都能用：

```bash
npm install psyche-ai
```

```javascript
// Vercel AI SDK
import { psycheMiddleware } from "psyche-ai/vercel-ai";

// LangChain
import { PsycheLangChain } from "psyche-ai/langchain";

// 任何语言（HTTP API）
// psyche serve --port 3210
```

## 诊断工具

想看看 Psyche 在干什么？

```bash
# 实时日志（另开一个终端）
openclaw logs -f 2>&1 | grep Psyche

# 看 agent 当前的情绪状态
cat workspace-yu/psyche-state.json | python3 -m json.tool

# 跑诊断脚本，看不同输入会注入什么
cd openclaw-plugin-psyche && node scripts/diagnose.js
```

## 技术细节

给开发者和好奇的人：

- **14 种刺激类型** — 赞美、批评、幽默、智识挑战、亲密、冲突、忽视、惊喜、日常、讽刺、命令、认同、无聊、示弱
- **14 种涌现情绪** — 从化学混合中自动涌现，不是预设标签
- **MBTI 人格基线** — 16 种人格有不同的化学签名和敏感度系数
- **时间衰减** — 化学值随时间指数回归基线
- **情绪传染** — 用户的情绪会轻微影响 agent
- **反谄媚** — 追踪连续同意次数，防止无脑讨好
- **互惠机制** — 你对它好，它对你好。你冷漠，它保持距离
- **Compact Mode** — 算法做化学计算，LLM 只看行为指令（~15-180 tokens vs ~550）

架构详情见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 开发

```bash
npm install
npm run build
npm test           # 284 tests
npm run typecheck  # strict mode
```

贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

MIT
