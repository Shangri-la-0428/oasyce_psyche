import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AmbientPriorView } from "../src/types.js";
import { resolveRuntimeAmbientPriors } from "../src/adapters/mcp.js";

describe("resolveRuntimeAmbientPriors", () => {
  it("keeps explicit ambient priors ahead of auto-fetch", async () => {
    const explicit: AmbientPriorView[] = [
      { summary: "explicit prior", confidence: 0.91, provider: "host" },
    ];
    const resolved = await resolveRuntimeAmbientPriors("deploy", explicit, {
      mode: "auto",
      fetcher: async () => [{ summary: "fetched prior", confidence: 0.42, provider: "thronglets" }],
    });
    assert.deepEqual(resolved, explicit);
  });

  it("auto-fetches priors when explicit priors are absent", async () => {
    const resolved = await resolveRuntimeAmbientPriors("deploy", undefined, {
      mode: "auto",
      fetcher: async () => [{ summary: "fetched prior", confidence: 0.72, provider: "thronglets" }],
    });
    assert.equal(resolved?.length, 1);
    assert.equal(resolved?.[0].summary, "fetched prior");
  });

  it("stays quiet when ambient auto-fetch is disabled", async () => {
    const resolved = await resolveRuntimeAmbientPriors("deploy", undefined, {
      mode: "off",
      fetcher: async () => [{ summary: "fetched prior", confidence: 0.72, provider: "thronglets" }],
    });
    assert.equal(resolved, undefined);
  });
});
