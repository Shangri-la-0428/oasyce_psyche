import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { PsycheEngine } from "../src/core.js";
import { MemoryStorageAdapter } from "../src/storage.js";
import { psycheMiddleware } from "../src/adapters/vercel-ai.js";
import { PsycheLangChain } from "../src/adapters/langchain.js";
import { createPsycheServer } from "../src/adapters/http.js";
import { register } from "../src/adapters/openclaw.js";

function makeEngine() {
  return new PsycheEngine(
    { mbti: "ENFP", name: "TestBot", locale: "zh", compactMode: true },
    new MemoryStorageAdapter(),
  );
}

// ── Vercel AI SDK Middleware ────────────────────────────

describe("psycheMiddleware (Vercel AI)", () => {
  let engine: PsycheEngine;

  before(async () => {
    engine = makeEngine();
    await engine.initialize();
  });

  it("transformParams injects system context", async () => {
    const mw = psycheMiddleware(engine);
    const result = await mw.transformParams({
      type: "generate",
      params: {
        prompt: [{ role: "user", content: "你好棒！" }],
      },
    });
    assert.ok(typeof result.system === "string");
    assert.ok(result.system.length > 0, "Should inject psyche context");
  });

  it("transformParams preserves existing system prompt", async () => {
    const mw = psycheMiddleware(engine);
    const result = await mw.transformParams({
      type: "generate",
      params: {
        system: "You are a helpful assistant.",
        prompt: [{ role: "user", content: "hi" }],
      },
    });
    assert.ok(result.system!.includes("You are a helpful assistant."));
  });

  it("transformParams handles empty prompt", async () => {
    const mw = psycheMiddleware(engine);
    const result = await mw.transformParams({
      type: "generate",
      params: { prompt: [] },
    });
    assert.ok(typeof result.system === "string");
  });

  it("wrapGenerate strips psyche_update tags", async () => {
    const mw = psycheMiddleware(engine);
    const result = await mw.wrapGenerate({
      doGenerate: async () => ({
        text: "Hello!\n\n<psyche_update>\nDA: 80\n</psyche_update>",
      }),
      params: {},
    });
    assert.equal(result.text, "Hello!");
    assert.ok(!result.text!.includes("psyche_update"));
  });

  it("wrapGenerate passes through when no text", async () => {
    const mw = psycheMiddleware(engine);
    const result = await mw.wrapGenerate({
      doGenerate: async () => ({ toolCalls: [] }),
      params: {},
    });
    assert.ok(!result.text);
  });

  it("extracts text from array content", async () => {
    const mw = psycheMiddleware(engine);
    const result = await mw.transformParams({
      type: "generate",
      params: {
        prompt: [
          { role: "user", content: [{ type: "text", text: "太棒了" }] },
        ],
      },
    });
    assert.ok(typeof result.system === "string");
    assert.ok(result.system!.length > 0);
  });
});

// ── LangChain Adapter ──────────────────────────────────

describe("PsycheLangChain", () => {
  let engine: PsycheEngine;
  let lc: PsycheLangChain;

  before(async () => {
    engine = makeEngine();
    await engine.initialize();
    lc = new PsycheLangChain(engine);
  });

  it("getSystemMessage returns non-empty context", async () => {
    const msg = await lc.getSystemMessage("你好");
    assert.ok(typeof msg === "string");
    assert.ok(msg.length > 0);
  });

  it("getSystemMessage changes chemistry", async () => {
    const before = engine.getState().meta.totalInteractions;
    await lc.getSystemMessage("太棒了！");
    const after = engine.getState().meta.totalInteractions;
    assert.ok(after > before, "Should increment interactions");
  });

  it("processResponse strips tags", async () => {
    const cleaned = await lc.processResponse(
      "Hi there!\n\n<psyche_update>\nDA: 85\n</psyche_update>",
    );
    assert.equal(cleaned, "Hi there!");
  });

  it("processResponse preserves text without tags", async () => {
    const cleaned = await lc.processResponse("Just a normal response");
    assert.equal(cleaned, "Just a normal response");
  });

  it("supports userId parameter", async () => {
    const msg = await lc.getSystemMessage("hello", { userId: "alice" });
    assert.ok(typeof msg === "string");
  });
});

// ── HTTP Adapter ───────────────────────────────────────

describe("createPsycheServer (HTTP)", () => {
  let engine: PsycheEngine;
  let server: http.Server;
  const PORT = 19876;

  before(async () => {
    engine = makeEngine();
    await engine.initialize();
    server = createPsycheServer(engine, { port: PORT });
    await new Promise<void>((r) => server.once("listening", r));
  });

  after(() => {
    server.close();
  });

  function req(method: string, path: string, body?: object): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const opts: http.RequestOptions = {
        hostname: "127.0.0.1", port: PORT, path, method,
        headers: body ? { "Content-Type": "application/json" } : {},
      };
      const r = http.request(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode!, data: JSON.parse(raw) });
        });
      });
      r.on("error", reject);
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  it("GET /state returns psyche state", async () => {
    const { status, data } = await req("GET", "/state");
    assert.equal(status, 200);
    assert.ok(data.current);
    assert.ok(data.baseline);
    assert.equal(data.mbti, "ENFP");
  });

  it("GET /protocol returns protocol text", async () => {
    const { status, data } = await req("GET", "/protocol?locale=zh");
    assert.equal(status, 200);
    assert.ok(typeof data.protocol === "string");
    assert.ok(data.protocol.includes("Psyche"));
  });

  it("POST /process-input returns context", async () => {
    const { status, data } = await req("POST", "/process-input", { text: "你好棒！" });
    assert.equal(status, 200);
    assert.ok(typeof data.dynamicContext === "string");
    assert.ok(data.dynamicContext.length > 0);
    assert.equal(data.stimulus, "praise");
  });

  it("POST /process-output strips tags", async () => {
    const { status, data } = await req("POST", "/process-output", {
      text: "Hi!\n\n<psyche_update>\nDA: 80\n</psyche_update>",
    });
    assert.equal(status, 200);
    assert.equal(data.cleanedText, "Hi!");
    assert.equal(data.stateChanged, true);
  });

  it("POST /process-output handles no tags", async () => {
    const { status, data } = await req("POST", "/process-output", { text: "Normal text" });
    assert.equal(status, 200);
    assert.equal(data.cleanedText, "Normal text");
  });

  it("returns 404 for unknown routes", async () => {
    const { status } = await req("GET", "/unknown");
    assert.equal(status, 404);
  });

  it("handles CORS preflight", async () => {
    return new Promise<void>((resolve, reject) => {
      const r = http.request({
        hostname: "127.0.0.1", port: PORT, path: "/state", method: "OPTIONS",
      }, (res) => {
        assert.equal(res.statusCode, 204);
        assert.ok(res.headers["access-control-allow-origin"]);
        resolve();
      });
      r.on("error", reject);
      r.end();
    });
  });

  it("POST /process-input with userId", async () => {
    const { status, data } = await req("POST", "/process-input", {
      text: "hello", userId: "bob",
    });
    assert.equal(status, 200);
    assert.ok(data.dynamicContext);
  });
});

// ── OpenClaw Adapter ─────────────────────────────────

describe("register (OpenClaw)", () => {
  it("registers 5 hooks when enabled", () => {
    const hooks: Array<{ event: string; priority: number }> = [];
    const fakeApi = {
      pluginConfig: { enabled: true, stripUpdateTags: true },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
      on(event: string, _handler: any, opts?: { priority: number }) {
        hooks.push({ event, priority: opts?.priority ?? 0 });
      },
      registerCli: () => {},
    };
    register(fakeApi as any);
    assert.equal(hooks.length, 5);
    assert.ok(hooks.some(h => h.event === "before_prompt_build"));
    assert.ok(hooks.some(h => h.event === "llm_output"));
    assert.ok(hooks.some(h => h.event === "before_message_write"));
    assert.ok(hooks.some(h => h.event === "message_sending"));
    assert.ok(hooks.some(h => h.event === "agent_end"));
  });

  it("skips tag-stripping hooks when stripUpdateTags=false", () => {
    const hooks: string[] = [];
    const fakeApi = {
      pluginConfig: { enabled: true, stripUpdateTags: false },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
      on(event: string) { hooks.push(event); },
      registerCli: () => {},
    };
    register(fakeApi as any);
    assert.ok(!hooks.includes("before_message_write"));
    assert.ok(!hooks.includes("message_sending"));
  });

  it("does nothing when disabled", () => {
    const hooks: string[] = [];
    const fakeApi = {
      pluginConfig: { enabled: false },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
      on(event: string) { hooks.push(event); },
    };
    register(fakeApi as any);
    assert.equal(hooks.length, 0);
  });

  it("before_prompt_build returns appendSystemContext", async () => {
    let capturedHandler: any;
    const fakeApi = {
      pluginConfig: { enabled: true, compactMode: true },
      logger: { info: () => {}, warn: () => {}, debug: () => {} },
      on(event: string, handler: any) {
        if (event === "before_prompt_build") capturedHandler = handler;
      },
      registerCli: () => {},
    };
    register(fakeApi as any);
    assert.ok(capturedHandler, "Should register before_prompt_build handler");
    // Without a real workspace, the handler should return {} gracefully
    const result = await capturedHandler({}, {});
    assert.deepEqual(result, {});
  });
});
