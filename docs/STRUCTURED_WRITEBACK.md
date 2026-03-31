# Structured Writeback

## What It Is

Structured writeback is the preferred path for hosts to report behavioral outcomes back to Psyche. Instead of relying on the LLM to emit `<psyche_update>` tags in its output (prompt protocol), the host passes typed signals directly into `processOutput()`. This is deterministic, portable, and does not depend on LLM compliance.

## Available Signals

These are the ten `WritebackSignalType` values defined in `src/types.ts`:

| Signal | Meaning |
|---|---|
| `trust_up` | Interaction increased felt trust and safety |
| `trust_down` | Interaction damaged trust or raised threat |
| `boundary_set` | Agent asserted a boundary or limit |
| `boundary_soften` | Agent relaxed a previously held boundary |
| `repair_attempt` | Agent initiated repair after tension or breach |
| `repair_landed` | A prior repair attempt was accepted by the partner |
| `closeness_invite` | Interaction moved toward greater intimacy |
| `withdrawal_mark` | Agent or partner pulled back from closeness |
| `self_assertion` | Agent expressed autonomous preference or position |
| `task_recenter` | Interaction redirected from relational tension to task |

Each signal updates relationship state, dyadic field values, and subject residue with calibrated weights. The engine deduplicates signals within a single call and applies per-partner learned gain via `signalWeights`.

## Integration Pattern

After the LLM generates a response, the host inspects the output and passes relevant signals into `processOutput()`:

```typescript
import { PsycheEngine, WritebackSignalType } from "psyche-ai";

const engine = new PsycheEngine({ /* config */ });

// Phase 1: build context for the LLM
const input = await engine.processInput(userMessage);
// ... send input.systemContext + input.dynamicContext to LLM ...

// Phase 2: process the LLM response with structured signals
const signals: WritebackSignalType[] = [];

if (responseSetBoundary(llmOutput))  signals.push("boundary_set");
if (responseShowedTrust(llmOutput))  signals.push("trust_up");
if (responseRefocusedTask(llmOutput)) signals.push("task_recenter");

const result = await engine.processOutput(llmOutput, {
  signals,
  signalConfidence: 0.85,  // 0-1, how certain the host is about these signals
  userId: "user-abc",
});

// result.cleanedText  — output with any <psyche_update> tags stripped
// result.stateChanged — whether state was updated
```

The same interface is available over HTTP when using the built-in server:

```
POST /process-output
{
  "text": "...",
  "signals": ["trust_up", "boundary_set"],
  "signalConfidence": 0.85,
  "userId": "user-abc"
}
```

## Why Prefer Structured Writeback

**Prompt protocol** asks the LLM to emit `<psyche_update>` XML tags containing chemistry deltas and metadata. This works but has structural problems:

- The LLM may forget, malformat, or hallucinate the tag contents.
- Different models comply at different rates.
- Tag parsing adds complexity to every adapter (buffering partial streams, stripping tags before display).
- The host has no control over what gets reported.

**Structured writeback** avoids all of these:

- Signals are typed and validated at the call boundary.
- The host decides what happened, not the LLM.
- No prompt formatting knowledge is required.
- Calibration data is tracked per signal, enabling the engine to learn which signals are reliable for each partner.
- Works identically across all adapters (Vercel AI, LangChain, OpenClaw, HTTP, MCP).

## Migration From Prompt Protocol

Hosts currently relying on `<psyche_update>` tags can migrate incrementally:

1. **Add signals alongside tags.** Pass `signals` in the `processOutput()` options. The engine merges both sources: tag-parsed signals and host-provided signals are deduplicated and applied together.

2. **Increase signal confidence.** As the host's signal detection improves, raise `signalConfidence` toward 1.0. The engine weights structured signals by confidence.

3. **Reduce prompt protocol reliance.** Once structured signals cover the relevant behavioral outcomes, the `<psyche_update>` tag becomes redundant for those signals. The tag path remains available for chemistry deltas and LLM-assisted stimulus classification, which are harder to detect host-side.

4. **Optionally disable tag emission.** Set `updateMode: "none"` in the psyche config to stop requesting `<psyche_update>` output from the LLM entirely. This saves tokens and removes a compliance dependency.

The engine does not require a hard cutover. Both paths coexist by design.
