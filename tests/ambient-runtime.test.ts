import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchAmbientPriorsFromThronglets,
  resolveAmbientPriorsForTurn,
} from "../src/ambient-runtime.js";

describe("fetchAmbientPriorsFromThronglets", () => {
  it("returns structured priors from machine envelope output", async () => {
    const priors = await fetchAmbientPriorsFromThronglets(
      "deploy the shared service after yesterday's breakage",
      {
        runner: async () => ({
          ok: true,
          stdout: JSON.stringify({
            schema_version: "thronglets.ambient.v1",
            command: "ambient-priors",
            data: {
              priors: [
                {
                  summary: "mixed residue: similar context still shows 2 success / 2 failure sessions",
                  confidence: 0.74,
                  kind: "mixed-residue",
                  provider: "thronglets",
                  refs: ["ctx:abcd", "space:psyche"],
                },
              ],
            },
          }),
          stderr: "",
        }),
      },
    );

    assert.equal(priors.length, 1);
    assert.equal(priors[0].provider, "thronglets");
    assert.equal(priors[0].kind, "mixed-residue");
    assert.equal(priors[0].summary.includes("mixed residue"), true);
  });

  it("returns empty when the helper fails", async () => {
    const priors = await fetchAmbientPriorsFromThronglets("check deployment", {
      runner: async () => ({
        ok: false,
        stdout: "",
        stderr: "binary missing",
      }),
    });

    assert.deepEqual(priors, []);
  });

  it("rejects incompatible ambient prior schema versions", async () => {
    const priors = await fetchAmbientPriorsFromThronglets("check deployment", {
      runner: async () => ({
        ok: true,
        stdout: JSON.stringify({
          schema_version: "thronglets.ambient.v999",
          command: "ambient-priors",
          data: {
            priors: [
              {
                summary: "stable path: stale schema should not be trusted",
                confidence: 0.9,
                kind: "success-prior",
              },
            ],
          },
        }),
        stderr: "",
      }),
    });

    assert.deepEqual(priors, []);
  });

  it("returns empty for blank input", async () => {
    const priors = await fetchAmbientPriorsFromThronglets("   ", {
      runner: async () => {
        throw new Error("should not run");
      },
    });

    assert.deepEqual(priors, []);
  });

  it("passes the current goal through to thronglets and preserves it in the returned prior", async () => {
    let stdinPayload = "";
    const priors = await fetchAmbientPriorsFromThronglets("repair the provider path", {
      goal: "repair",
      runner: async (_binary, _args, stdin) => {
        stdinPayload = stdin;
        return {
          ok: true,
          stdout: JSON.stringify({
            schema_version: "thronglets.ambient.v1",
            command: "ambient-priors",
            data: {
              priors: [
                {
                  summary: "failure residue: similar repair path failed recently",
                  confidence: 0.79,
                  kind: "failure-residue",
                  goal: "repair",
                  provider: "thronglets",
                },
              ],
            },
          }),
          stderr: "",
        };
      },
    });

    assert.equal(JSON.parse(stdinPayload).goal, "repair");
    assert.equal(priors.length, 1);
    assert.equal(priors[0].goal, "repair");
  });

  it("passes current-turn correction through to thronglets and compiles a hard task rule locally", async () => {
    let stdinPayload = "";
    await fetchAmbientPriorsFromThronglets("fix the dashboard page", {
      currentTurnCorrection: "reuse existing shared components",
      runner: async (_binary, _args, stdin) => {
        stdinPayload = stdin;
        return {
          ok: true,
          stdout: JSON.stringify({
            schema_version: "thronglets.ambient.v1",
            command: "ambient-priors",
            data: { priors: [] },
          }),
          stderr: "",
        };
      },
    });

    const payload = JSON.parse(stdinPayload) as {
      current_turn_correction?: string;
      active_policy?: Array<{ id: string; strength: string; scope: string; summary: string }>;
    };
    assert.equal(payload.current_turn_correction, "reuse existing shared components");
    assert.equal(payload.active_policy?.length, 1);
    assert.deepEqual(payload.active_policy?.[0], {
      id: "task:current-turn-correction",
      strength: "hard",
      scope: "task",
      summary: "reuse existing shared components",
    });
  });

  it("uses current-turn correction when resolving ambient priors without a structured activePolicy object", async () => {
    let stdinPayload = "";
    const priors = await resolveAmbientPriorsForTurn("repair the page shell", {
      currentTurnCorrection: "reuse existing shared components",
      fetcher: async (_text, opts = {}) => {
        stdinPayload = JSON.stringify({
          current_turn_correction: opts.currentTurnCorrection,
          active_policy: opts.activePolicy,
        });
        return [{
          summary: "policy conflict: duplicate UI edits remain unsettled under the current correction",
          confidence: 0.77,
          kind: "mixed-residue",
          policyState: "policy-conflict",
        }];
      },
    });

    const payload = JSON.parse(stdinPayload) as {
      current_turn_correction?: string;
      active_policy?: Array<{ id: string; strength: string; scope: string; summary: string }>;
    };
    assert.equal(payload.current_turn_correction, "reuse existing shared components");
    assert.equal(payload.active_policy?.[0]?.id, "task:current-turn-correction");
    assert.equal(priors?.length, 1);
    assert.equal(priors?.[0].policyState, "policy-conflict");
  });
});
