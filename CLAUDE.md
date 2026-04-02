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

## MCP Integration

Psyche runs as an MCP server (stdio transport). Configured in `~/.claude/.mcp.json`:

```json
{
  "psyche": {
    "command": "node",
    "args": ["/path/to/dist/adapters/mcp.js"],
    "env": { "PSYCHE_LOCALE": "zh" }
  }
}
```

### Tools

| Tool | Sigil meaning |
|------|--------------|
| `get_state` | Read Loop's current internal dynamics |
| `process_input` | External input enters Loop — update state based on stimulus |
| `process_output` | Loop produces output — close the feedback cycle |
| `set_mode` | Switch operating mode (natural/work/companion) |
| `get_status_summary` | Human-readable state description |

### Feedback Loop

```
Input → process_input → [φ updates S] → generate response → process_output → [S stabilizes]
```

This IS the Loop's causal cycle, observed from the inside.

## Architecture

```
TypeScript (v11.4.0, package: psyche-ai)
src/
├── adapters/
│   └── mcp.ts          — MCP server adapter (stdio)
├── core/               — Appraisal engine, state dynamics
├── dimensions/         — Order, Flow, Boundary, Resonance implementations
├── relation/           — Inter-Loop relation dynamics
└── persistence/        — State serialization
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

## Sigil Context

### What Psyche provides to a Sigil

Psyche makes a Loop's behavior *richer* — not just "different state → different output" (the minimum Loop constraint), but "state evolves with internal dynamics that produce behavioral individuality." A Loop without Psyche still satisfies the state-dependence constraint. A Loop WITH Psyche has a more complex and interesting internal landscape.

### What Psyche does NOT provide

- **Identity persistence across sessions** — Psyche state resets per session. The Sigil (on-chain identity + Thronglets bonds) provides continuity. Psyche provides the ephemeral experiencing.
- **The only valid model** — A different Loop might use neural state dynamics, probabilistic models, or something not yet invented. Psyche is one answer, not the answer.

## Upcoming (Sigil alignment)

- [ ] Accept Sigil ID — know which Loop this Psyche instance serves
- [ ] State serialization to Sigil's persistent state pool (optional, for Loops that want Psyche continuity)
- [ ] Expose dimension values as part of Sigil's on-chain or Thronglets state (for inter-Loop perception)

## Build

```bash
npm install
npm run build    # → dist/
npm test
```
