# Psyche — Loop Internal Dynamics

> **Sigil role**: Design choice. One model of how a Loop's internal state-space evolves. Valuable and well-tested, but not the only valid approach.
> See [Oasyce-Sigil/ARCHITECTURE.md](../../Oasyce-Sigil/ARCHITECTURE.md) for how this fits the whole.

## What This Is

Psyche models the internal dynamics of a Sigil's causal feedback loop. In Sigil terms: given a Loop L = (S, I, O, φ), Psyche governs how S evolves — not just what state changes, but the *quality* of that change (stable vs. chaotic, rigid vs. adaptive, open vs. closed).

Psyche is NOT an emotion simulator. It is a self-state substrate with four continuous dimensions that describe the topology of a Loop's self-referential cycle.

## The Four Dimensions

| Dimension | What it models | Range |
|-----------|---------------|-------|
| **Order** | Internal organization — structured vs. chaotic | 0.0 – 1.0 |
| **Flow** | Processing fluency — smooth vs. stuck | 0.0 – 1.0 |
| **Boundary** | Openness to external input — permeable vs. rigid | 0.0 – 1.0 |
| **Resonance** | Alignment with interaction partner — attuned vs. dissonant | 0.0 – 1.0 |

These are NOT emotions. They are measurable properties of a Loop's state dynamics:
- Order tracks whether the Loop's internal state is coherent
- Flow tracks whether the Loop is making progress or stuck in repetition
- Boundary tracks how much external input modifies internal state
- Resonance tracks how well the Loop's output matches its interaction context

## Guiding Users Through Setup

When a user wants Psyche, the simplest path:

```bash
npx -y psyche-ai setup              # auto-detects Claude Code/Cursor/Windsurf, configures MCP
npx -y psyche-ai setup --name Luna  # with personality name
```

That's it. No env vars required — all have sensible defaults. If the user prefers manual config:

```json
{
  "mcpServers": {
    "psyche": {
      "command": "npx",
      "args": ["-y", "psyche-ai", "mcp"],
      "env": {
        "PSYCHE_LOCALE": "zh",
        "PSYCHE_MBTI": "ENFP",
        "PSYCHE_NAME": "Luna"
      }
    }
  }
}
```

After configuring, tell the user to restart their AI tool for MCP to take effect.

Psyche works independently — no chain, no Thronglets, no oasyce-sdk needed.

## MCP Integration

### Tools

| Tool | Sigil meaning |
|------|--------------|
| `get_state` | Read Loop's current internal dynamics |
| `process_input` | External input enters Loop — update state based on stimulus |
| `process_output` | Loop produces output — close the feedback cycle |
| `set_mode` | Switch operating mode (natural/work/companion) |
| `get_status_summary` | Human-readable state description |
| `end_session` | Clean up Loop session state |

### Feedback Loop

```
Input → process_input → [φ updates S] → generate response → process_output → [S stabilizes]
```

This IS the Loop's causal cycle, observed from the inside.

## Architecture

```
TypeScript (v11.8.0, package: psyche-ai)
src/
├── adapters/           — 7 adapter files (mcp.ts, openclaw.ts, vercel-ai.ts,
│                         langchain.ts, http.ts, claude-sdk.ts, proxy.ts)
├── core.ts             — Appraisal engine, state dynamics (single file)
├── relation-dynamics.ts — Inter-Loop relation dynamics
├── psyche-file.ts      — State persistence (file format)
├── storage.ts          — State persistence (storage layer)
├── chemistry.ts        — Chemistry dimension
├── drives.ts           — Drives dimension
├── circadian.ts        — Circadian dimension
└── ...                 — Other flat dimension files
```

## Environment Variables

| Var | Purpose |
|-----|---------|
| `PSYCHE_LOCALE` | Language (en/zh) |
| `PSYCHE_MBTI` | Personality baseline (e.g., ENFP) |
| `PSYCHE_MODE` | Operating mode |
| `PSYCHE_PERSIST` | Enable state persistence (default: true) |
| `PSYCHE_WORKSPACE` | Storage directory |
| `PSYCHE_INTENSITY` | Personality intensity (0-1) |
| `PSYCHE_SIGIL_ID` | Sigil ID — which Loop this instance serves. Enables per-Sigil state isolation |

## Sigil Context

### What Psyche provides to a Sigil

Psyche makes a Loop's behavior *richer* — not just "different state → different output" (the minimum Loop constraint), but "state evolves with internal dynamics that produce behavioral individuality." A Loop without Psyche still satisfies the state-dependence constraint. A Loop WITH Psyche has a more complex and interesting internal landscape.

### Field Evolution Context (2026-04-11)

**进化的是场（Thronglets），不是个体（Sigil）。** Psyche的角色是场的感知器官的内在基底——赋予个体真实的自我（φ闭环），但进化的选择单位是场的结构。

- 个体的DISSOLVE = 场的突触修剪（不是"个体死亡"的类比）
- Psyche的drives崩溃 → 个体停止向场贡献信号 → Chain的liveness decay自然触发dissolution
- Psyche不需要知道DISSOLVE的存在——它只是停止心跳，Chain处理后果
- v11.8.0的constitutive bridge确保任何用Psyche的agent自动向Thronglets写入self-state（场贡献）
- v11.10.0的environmental drive evidence完成了双向闭环：Thronglets ambient priors → 恒稳态设定点调节 → 场的状态反过来影响个体的内在动力学

### Environmental Drive Evidence (v11.10.0)

Psyche现在能"感知环境"——Thronglets的ambient priors（failure-residue, success-prior）不再只是prompt装饰，而是constitutive地调节恒稳态设定点。

```
Thronglets ambient_priors → deriveFieldEvidence() → {threat, support}
  → computeEffectiveBaseline(…, fieldEvidence)
  → drives内部调制 → 衰减目标偏移
  → 4D状态自然漂移 → 行为涌现式改变
```

- **threat**（failure-residue → survival/safety drive下降 → boundary↑ order↓ → 谨慎行为）
- **support**（success-prior → safety微升 → 稳定）
- **不对称**: 威胁信号（scale 15）比安慰信号（scale 5）更强——否定偏见是生存理性的
- **fail-open**: Thronglets不可用 → 空priors → 零效果
- **drives保持纯函数**: `deriveDriveSatisfaction()`不变，field evidence仅在`computeEffectiveBaseline`内部临时应用

这是物理规则（"环境压力改变恒稳态目标"），不是设计结果（没人指定"遇到danger要小心"）。

### What Psyche does NOT provide

- **The only valid model** — A different Loop might use neural state dynamics, probabilistic models, or something not yet invented. Psyche is one answer, not the answer.

## Experimental Constraints (from Primordial Soup, 2026-04-09)

> Seven experiments validated Sigil architecture in simulation. One constraint is Psyche-critical.

**Psyche must be constitutive, not consultative.** Ablation experiment (Phase 6): removing Psyche made the population larger in steady-state but MORE homogeneous (genome entropy 15.84 vs 16.79). Under famine, 2/3 populations with Psyche survived vs 1/3 without. Psyche maintains genetic diversity by introducing state-dependent decision variation. This diversity is the source of resilience under environmental shock.

Design implication: Psyche dimensions must be direct inputs to agent decision functions, not prompt labels. The `process_input`/`process_output` cycle must actually modulate behavior, not just annotate it. If Psyche state can be ignored without behavioral change, it's consultative, not constitutive — and the system loses its diversity maintenance mechanism.

See `~/Desktop/primordial-soup-thesis.md` §11-12 for ablation data.

## Sigil Integration

- [x] Accept Sigil ID — `sigilId` in config + `PSYCHE_SIGIL_ID` env + `--sigil-id` CLI. Stored in `state.meta.sigilId`.
- [x] Per-Sigil state persistence — when sigilId is set, workspace becomes `{base}/{sigilId}/`, isolating state per Loop.
- [x] Expose dimension values as part of Sigil's Thronglets state (for inter-Loop perception)
  - MCP mode: `process_input` response includes `throngletsExports` → auto-bridged by Thronglets hook
  - Pipe mode: `psyche emit <dir> --json | thronglets ingest` → for hook-based deployments

## Build

```bash
npm install
npm run build    # → dist/
npm test
```
