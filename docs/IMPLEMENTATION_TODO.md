# Implementation TODO — Identity and Boundary

This file translates the frozen blueprint into implementation work.

## Immediate

### 1. Formalize sparse Psyche → Thronglets export

Define the exact low-frequency event set that may leave Psyche.

Target shape:

- typed
- thresholded
- attributable
- low-frequency

Examples to evaluate:

- relation milestone reached
- repair crossed threshold
- continuity anchor requested
- significant writeback convergence

### 2. Keep high-frequency subjectivity local

Audit current integrations and explicitly ensure these never become shared primitives:

- chemistry
- raw residue
- raw session state
- per-turn open loop internals

### 3. Make delegate boundaries capability-scoped

Every delegate authorization should be able to answer:

- what can it do?
- until when?
- under what revocation condition?
- under which account/principal?

### 4. Clarify authorization truth flow

Document and implement:

- Chain is authorization truth
- Net is policy/orchestration
- Thronglets caches and executes within that truth

## Near-Term

### 5. Session trace taxonomy

Define which trace classes belong in Thronglets and which remain purely local.

### 6. Principal gate checklist

Turn the institutional AI-principal gate into a concrete evaluation checklist.

### 7. Diagnostics by layer

Split diagnostics explicitly by:

- subjective continuity
- delegate continuity
- policy/orchestration
- public fact/finality

## Continuous Discipline

### 8. Reject new identity objects by default

When a new concept appears, try in order:

1. derived view
2. policy
3. trace
4. one of the four primitives

Only if all fail should a new top-level identity object even be discussed.

### 9. Keep collectives environmental

Prefer:

- spaces
- signals
- trace accumulation
- promotion / inhibition / decay

Avoid introducing anthropomorphic collective entities unless absolutely forced by reality.

### 10. Re-check the frozen blueprint before new features

Before identity-related work lands, confirm it still preserves:

1. Thronglets useful without Oasyce
2. Oasyce additive, not rewriting
3. AI-principal future without model rewrite
4. environmental emergence over message-role imitation
