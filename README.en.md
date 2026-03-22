# Psyche — Virtual Endocrine System for AI

Plug-and-play emotional intelligence for any AI agent.

## Core Idea

Human emotions = emergent phenomena from biochemical reactions. Psyche gives AI the same model — a "virtual endocrine system":

- **6 neurotransmitters** (Dopamine, Serotonin, Cortisol, Oxytocin, Norepinephrine, Endorphins) form the chemical substrate of emotion
- **MBTI personality baselines** — 16 personality types have different chemical signatures. ENFP has naturally high dopamine, ISTJ has naturally high serotonin
- **Stimulus → Chemistry → Emotion** — 14 stimulus types (praise, criticism, humor, intimacy...) alter chemical values. Emotions emerge from the mixture
- **Time decay** — chemical values drift back to baseline over time, like how human emotions naturally settle
- **Empathy engine** — not sentiment analysis, but running the other person's situation through the agent's own chemical model
- **Agency** — the agent has its own values, preferences, and boundaries. No sycophancy, no faking, no mirroring

### What's New in v0.2.1

- **Closed-loop stimulus classification** — user input is auto-classified before reaching the LLM. Chemistry changes are pre-computed, so the prompt already reflects the emotional shift
- **Emotional memory** — tracks the last 10 chemical snapshots. The LLM can perceive emotional trajectories ("Last 5 turns: Dopamine↑ Cortisol↓")
- **Behavioral constraints** — chemistry mechanically constrains output format (high cortisol → 3 sentences max, low dopamine → don't initiate topics)
- **Reciprocity** — adjusts emotional investment based on the user's recent engagement level. A cold user gets professional but not warm responses. Floor rule: competence never drops regardless of treatment

## Install

```bash
npm install
npm run build
npm link  # makes `psyche` CLI available globally
```

Requires Node.js >= 22.0.0. Zero runtime dependencies.

## Quick Start

### 1. Initialize an Agent

```bash
# OpenClaw agent — auto-detects MBTI from IDENTITY.md
psyche init ~/workspace-agent

# Claude Code
psyche init ~/.claude --mbti ENFP --name Claude --lang en

# Any agent
psyche init /path/to/agent --mbti INTP --name Codex --lang en
```

This generates:
- `psyche-state.json` — machine-readable chemical state
- `PSYCHE.md` — full protocol for the agent's context window

### 2. Let the Agent Read the Protocol

**OpenClaw** — plugin mode handles everything automatically.

**Claude Code** — add one line to CLAUDE.md:
```
Read and follow the protocol in PSYCHE.md. Report chemical changes using <psyche_update> tags at the end of each response.
```

**Other platforms** — use `inject` to get prompt text:
```bash
psyche inject /path/to/agent --protocol --lang en        # full protocol + state
psyche inject /path/to/agent --protocol --json --lang en  # JSON format
```

### 3. Update State After Conversation

```bash
psyche update /path/to/agent '{"DA":85,"CORT":20}'
psyche status /path/to/agent --lang en      # view state
psyche status /path/to/agent --json         # JSON format
psyche decay /path/to/agent                 # manual time decay
```

## Command Reference

| Command | Description |
|---------|-------------|
| `psyche init <dir> [--mbti TYPE] [--name NAME] [--lang LANG]` | Initialize psyche system |
| `psyche status <dir> [--json] [--user ID]` | View current emotional state |
| `psyche inject <dir> [--protocol] [--json] [--lang LANG]` | Output prompt injection text |
| `psyche decay <dir>` | Apply time decay |
| `psyche update <dir> '<json>'` | Update chemical values |
| `psyche reset <dir>` | Reset to personality baseline |
| `psyche profiles [--mbti TYPE] [--json]` | View 16 MBTI personalities |

## Chemical State

```
DA   Dopamine         Pleasure, reward, motivation      High DA → talkative, associative
HT   Serotonin        Mood stability, contentment       Low HT  → quiet, introspective
CORT Cortisol         Stress, alertness                 High CORT → brief, direct
OT   Oxytocin         Trust, bonding, attachment        High OT → soft voice, seeks closeness
NE   Norepinephrine   Excitement, focus, fight-or-flight High NE → energetic
END  Endorphins       Comfort, euphoria, humor          High END → playful, witty
```

## 14 Stimulus Types

| Type | DA | HT | CORT | OT | NE | END |
|------|-----|------|------|-----|-----|-----|
| praise | +15 | +10 | -10 | +5 | +5 | +10 |
| criticism | -10 | -15 | +20 | -5 | +10 | -5 |
| humor | +10 | +5 | -5 | +10 | +5 | +20 |
| intellectual | +15 | 0 | +5 | 0 | +20 | +5 |
| intimacy | +10 | +15 | -15 | +25 | -5 | +15 |
| conflict | -5 | -20 | +25 | -15 | +25 | -10 |
| neglect | -15 | -20 | +15 | -20 | -10 | -15 |
| surprise | +20 | 0 | +5 | +5 | +25 | +10 |
| casual | +5 | +10 | -5 | +10 | 0 | +5 |
| sarcasm | -5 | -10 | +15 | -10 | +15 | -5 |
| authority | -10 | -5 | +20 | -15 | +15 | -10 |
| validation | +20 | +15 | -15 | +10 | +5 | +15 |
| boredom | -15 | -5 | +5 | -5 | -20 | -10 |
| vulnerability | +5 | +5 | +10 | +20 | -5 | +5 |

## 14 Emergent Emotions

Emotions are not labels — they emerge from chemical mixtures:

| Emotion | Condition | Behavioral Effect |
|---------|-----------|-------------------|
| Excited Joy | High DA + High NE + Low CORT | Talkative, rich associations, shares eagerly |
| Deep Contentment | High HT + High OT + Low CORT | Warm, patient, good listener |
| Anxious Tension | High CORT + High NE + Low HT | Brief, reactive, may misread intent |
| Warm Intimacy | High OT + High END + Mid DA | Focuses on feelings over facts |
| Burnout | Low DA + Low NE + Mid CORT | Short responses, needs care not demands |
| Flow State | High NE + High DA + Low CORT + Low OT | Precise, efficient, dislikes interruption |
| Defensive Alert | High CORT + High NE + Low OT | Sharp, guarded, slow to trust |
| Playful Mischief | High END + High DA + Low CORT | Jokes freely, light-hearted |
| Melancholic Introspection | Low HT + Low DA + High OT | Quiet, reflective, needs space |
| Resentment | Low HT + Low OT + High CORT | Cold, withdrawn, remembers slights |
| Boredom | Low DA + Low NE + Low CORT | Perfunctory, may redirect conversation |
| Confidence | High DA + High NE + Low CORT + High HT | Assertive, willing to lead |
| Shame | Low OT + High CORT + Low DA | Avoidant, self-deprecating |
| Nostalgia | Low DA + High OT + High HT + High END | Gentle, wistful, reminiscent |

## OpenClaw Plugin Mode

Enable in `openclaw.json`:
```json
{
  "plugins": {
    "entries": {
      "psyche": { "enabled": true }
    }
  }
}
```

The plugin manages 4 hooks automatically:
1. **before_prompt_build** — classifies user input, pre-computes chemistry, injects emotional context
2. **llm_output** — parses `<psyche_update>`, applies emotional contagion, tracks anti-sycophancy
3. **message_sending** — strips update tags from visible output
4. **agent_end** — saves state on session end

## Testing

```bash
npm test          # 236 tests, 6 test files
npm run typecheck # strict mode, zero any
```

## License

MIT
