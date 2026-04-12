import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bridgeThrongletsExports, resolveThrongletsBinary } from "../src/thronglets-bridge.js";
import { deriveThrongletsExports, markThrongletsExportsEmitted } from "../src/thronglets-export.js";
import { serializeThrongletsExportAsTrace, taxonomyForThrongletsExport } from "../src/thronglets-runtime.js";
import type { ThrongletsExport } from "../src/types.js";
import {
  DEFAULT_DRIVES,
  DEFAULT_DYADIC_FIELD,
  DEFAULT_LEARNING_STATE,
  DEFAULT_METACOGNITIVE_STATE,
  DEFAULT_PERSONHOOD_STATE,
  DEFAULT_RELATIONSHIP,
} from "../src/types.js";

// ── Mock runner ──────────────────────────────────────────────

function mockRunner(response: { ok: boolean; stdout?: string; stderr?: string }) {
  const calls: Array<{ binary: string; args: string[]; stdin: string }> = [];
  const runner = async (binary: string, args: string[], stdin: string, _timeout: number) => {
    calls.push({ binary, args, stdin });
    return { ok: response.ok, stdout: response.stdout ?? "", stderr: response.stderr ?? "" };
  };
  return { runner, calls };
}

const SAMPLE_EXPORT: ThrongletsExport = {
  kind: "self-state" as const,
  subject: "session",
  primitive: "signal",
  userKey: "_default",
  strength: 0.6,
  ttlTurns: 12,
  key: "self-state:O50:F60:B40:R50",
  order: 50,
  flow: 60,
  boundary: 40,
  resonance: 50,
  summary: "neutral",
};

function makeExportState(): any {
  const now = new Date().toISOString();
  return {
    version: 10,
    sensitivity: 1,
    baseline: { order: 50, flow: 50, boundary: 50, resonance: 50 },
    current: { order: 50, flow: 50, boundary: 50, resonance: 50 },
    drives: { ...DEFAULT_DRIVES },
    updatedAt: now,
    relationships: {
      _default: { ...DEFAULT_RELATIONSHIP, trust: 82, intimacy: 74, phase: "close" },
    },
    empathyLog: null,
    selfModel: { values: [], preferences: [], boundaries: [], currentInterests: [] },
    stateHistory: [],
    agreementStreak: 0,
    lastDisagreement: null,
    learning: { ...DEFAULT_LEARNING_STATE },
    metacognition: { ...DEFAULT_METACOGNITIVE_STATE },
    personhood: { ...DEFAULT_PERSONHOOD_STATE },
    dyadicFields: {
      _default: {
        ...DEFAULT_DYADIC_FIELD,
        openLoops: [{ type: "existence-test", intensity: 0.7, ageTurns: 1 }],
        unfinishedTension: 0.7,
        silentCarry: 0.6,
        updatedAt: now,
      },
    },
    meta: { agentName: "Test", createdAt: now, totalInteractions: 1, locale: "en", mode: "natural" },
  };
}

function assertTracePayloadShape(payload: ReturnType<typeof serializeThrongletsExportAsTrace>) {
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["external_continuity", "model", "outcome", "session_id"],
  );
  assert.deepEqual(
    Object.keys(payload.external_continuity).sort(),
    ["audit_ref", "event", "mode", "provider", "space", "summary", "taxonomy", "version"],
  );
}

// ── bridgeThrongletsExports ─────────────────────────────────

describe("bridgeThrongletsExports", () => {
  it("spawns ingest with correct args and stdin", async () => {
    const { runner, calls } = mockRunner({ ok: true, stdout: '{"ingested":1}' });
    const result = await bridgeThrongletsExports([SAMPLE_EXPORT], {
      runner, binaryPath: "/usr/bin/thronglets",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].binary, "/usr/bin/thronglets");
    assert.ok(calls[0].args.includes("ingest"));
    assert.ok(calls[0].args.includes("--json"));
    const parsed = JSON.parse(calls[0].stdin);
    assert.ok(Array.isArray(parsed.throngletsExports));
    assert.equal(parsed.throngletsExports[0].key, SAMPLE_EXPORT.key);
    assert.equal(result, 1);
  });

  it("passes --space and --session when configured", async () => {
    const { runner, calls } = mockRunner({ ok: true });
    await bridgeThrongletsExports([SAMPLE_EXPORT], {
      runner, binaryPath: "t", space: "test-space", sessionId: "s123",
    });
    assert.ok(calls[0].args.includes("--space"));
    assert.ok(calls[0].args.includes("test-space"));
    assert.ok(calls[0].args.includes("--session"));
    assert.ok(calls[0].args.includes("s123"));
  });

  it("returns 0 for empty exports", async () => {
    const { runner, calls } = mockRunner({ ok: true });
    const result = await bridgeThrongletsExports([], { runner });
    assert.equal(result, 0);
    assert.equal(calls.length, 0);
  });

  it("returns 0 when disabled", async () => {
    const { runner, calls } = mockRunner({ ok: true });
    const result = await bridgeThrongletsExports([SAMPLE_EXPORT], {
      runner, enabled: false,
    });
    assert.equal(result, 0);
    assert.equal(calls.length, 0);
  });

  it("returns 0 when runner fails (fail-open)", async () => {
    const { runner } = mockRunner({ ok: false, stderr: "binary not found" });
    const result = await bridgeThrongletsExports([SAMPLE_EXPORT], {
      runner, binaryPath: "nonexistent",
    });
    assert.equal(result, 0);
  });

  it("returns 0 when runner throws (fail-open)", async () => {
    const throwing = async () => { throw new Error("spawn failed"); };
    const result = await bridgeThrongletsExports([SAMPLE_EXPORT], {
      runner: throwing as never, binaryPath: "t",
    });
    assert.equal(result, 0);
  });

  it("returns export count when stdout is not JSON", async () => {
    const { runner } = mockRunner({ ok: true, stdout: "ok" });
    const result = await bridgeThrongletsExports([SAMPLE_EXPORT, SAMPLE_EXPORT], {
      runner, binaryPath: "t",
    });
    assert.equal(result, 2);
  });

  it("keeps viability exports on the viability kind and maps only the frozen taxonomy set", () => {
    const events: ThrongletsExport[] = [
      {
        kind: "relation-milestone",
        subject: "delegate",
        primitive: "signal",
        userKey: "alice",
        strength: 0.8,
        ttlTurns: 8,
        key: "milestone:alice:familiar",
        phase: "familiar",
        trust: 61,
        intimacy: 44,
      },
      {
        kind: "continuity-anchor",
        subject: "session",
        primitive: "trace",
        userKey: "alice",
        strength: 0.76,
        ttlTurns: 3,
        key: "continuity:alice:guarded-resume",
        continuityMode: "guarded-resume",
        activeLoopTypes: ["existence-test"],
        continuityFloor: 0.58,
      },
      {
        kind: "viability",
        subject: "session",
        primitive: "signal",
        userKey: "alice",
        strength: 0.5,
        ttlTurns: 12,
        key: "viability:viable:survival:40",
        viable: true,
        minDrive: 42,
        minDriveType: "survival",
      },
    ];

    const viability = events.find((event) => event.kind === "viability");
    assert.ok(viability, "expected a viability export in the frozen sample set");
    assert.equal(viability.kind, "viability");

    const taxonomies = new Set(
      events.map((event) => taxonomyForThrongletsExport(event)),
    );
    assert.deepEqual([...taxonomies].sort(), ["calibration", "continuity", "coordination"]);

    const payload = serializeThrongletsExportAsTrace(viability, {
      model: "psyche",
      sessionId: "psyche-bridge",
      space: "psyche",
      outcome: "succeeded",
    });
    assert.equal(payload.external_continuity.event, "viability");
    assert.equal(payload.external_continuity.taxonomy, "calibration");
    assertTracePayloadShape(payload);
  });

  it("does not suppress re-emission until exports are marked as emitted", () => {
    const state = makeExportState();
    const relationContext = {
      key: "_default",
      relationship: state.relationships._default,
      field: state.dyadicFields._default,
      pendingSignals: [],
    };

    const first = deriveThrongletsExports(state, {
      relationContext,
      sessionBridge: null,
      writebackFeedback: [],
      now: new Date().toISOString(),
    });
    assert.ok(first.exports.length > 0, "expected initial exports");

    const second = deriveThrongletsExports(first.state, {
      relationContext,
      sessionBridge: null,
      writebackFeedback: [],
      now: new Date().toISOString(),
    });
    assert.equal(second.exports.length, first.exports.length, "failed bridge should not burn dedupe keys");

    const marked = markThrongletsExportsEmitted(first.state, first.exports, new Date().toISOString());
    const third = deriveThrongletsExports(marked, {
      relationContext,
      sessionBridge: null,
      writebackFeedback: [],
      now: new Date().toISOString(),
    });
    assert.equal(third.exports.length, 0, "successful bridge should suppress immediate duplicate re-emission");
  });

  it("serializes a sparse export into the Thronglets trace ingest schema", () => {
    const payload = serializeThrongletsExportAsTrace({
      kind: "relation-milestone",
      subject: "delegate",
      primitive: "signal",
      userKey: "alice",
      strength: 0.82,
      ttlTurns: 8,
      key: "milestone:alice:familiar",
      phase: "familiar",
      trust: 64,
      intimacy: 46,
    }, {
      sessionId: "psyche-ingest",
      model: "psyche",
      outcome: "succeeded",
      space: "psyche",
    });

    assert.equal(payload.outcome, "succeeded");
    assert.equal(payload.model, "psyche");
    assert.equal(payload.session_id, "psyche-ingest");
    assert.equal(payload.external_continuity.provider, "thronglets");
    assert.equal(payload.external_continuity.mode, "optional");
    assert.equal(payload.external_continuity.version, 1);
    assert.equal(payload.external_continuity.taxonomy, "coordination");
    assert.equal(payload.external_continuity.event, "relation-milestone");
    assert.equal(payload.external_continuity.audit_ref, "milestone:alice:familiar");
    assertTracePayloadShape(payload);
  });
});

// ── resolveThrongletsBinary ─────────────────────────────────

describe("resolveThrongletsBinary", () => {
  it("returns explicit path when provided", () => {
    assert.equal(resolveThrongletsBinary("/custom/bin"), "/custom/bin");
  });

  it("falls back to PATH when no explicit or env", () => {
    const saved = process.env.THRONGLETS_BIN;
    delete process.env.THRONGLETS_BIN;
    try {
      const result = resolveThrongletsBinary();
      // Either finds managed binary or falls back to "thronglets"
      assert.ok(typeof result === "string" && result.length > 0);
    } finally {
      if (saved !== undefined) process.env.THRONGLETS_BIN = saved;
    }
  });
});
