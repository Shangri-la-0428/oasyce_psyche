import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyStimulus, getPrimaryStimulus } from "../src/classify.js";
import type { StimulusType } from "../src/types.js";

// ── classifyStimulus ────────────────────────────────────────

describe("classifyStimulus", () => {
  it("detects praise in Chinese", () => {
    const result = classifyStimulus("你做得太棒了，真不错");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "praise");
    assert.ok(result[0].confidence >= 0.8);
  });

  it("detects praise in English", () => {
    const result = classifyStimulus("That was amazing, great job!");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "praise");
  });

  it("detects criticism", () => {
    const result = classifyStimulus("这个不对，有问题");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "criticism");
  });

  it("detects humor", () => {
    const result = classifyStimulus("哈哈哈笑死我了");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "humor");
  });

  it("detects intellectual stimulus", () => {
    const result = classifyStimulus("为什么这个架构要这样设计？");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "intellectual");
  });

  it("detects intimacy", () => {
    const result = classifyStimulus("我信任你，跟你说个秘密");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "intimacy");
  });

  it("detects conflict", () => {
    const result = classifyStimulus("你错了，胡说八道");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "conflict");
  });

  it("detects neglect", () => {
    const result = classifyStimulus("随便吧，无所谓");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "neglect");
  });

  it("detects surprise", () => {
    const result = classifyStimulus("天啊不会吧，没想到！");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "surprise");
  });

  it("detects sarcasm", () => {
    const result = classifyStimulus("哦是吗，你说的都对，呵呵");
    assert.ok(result.length > 0);
    const sarcasm = result.find((r) => r.type === "sarcasm");
    assert.ok(sarcasm, "Should detect sarcasm");
    assert.equal(result[0].type, "sarcasm");
  });

  it("detects authority", () => {
    const result = classifyStimulus("你必须马上给我做完");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "authority");
  });

  it("detects validation", () => {
    const result = classifyStimulus("你说得对，确实有道理");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "validation");
  });

  it("detects boredom", () => {
    const result = classifyStimulus("好无聊啊，没意思");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "boredom");
  });

  it("detects vulnerability", () => {
    const result = classifyStimulus("我害怕，最近压力好大，我累了");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "vulnerability");
  });

  it("detects casual greeting", () => {
    const result = classifyStimulus("你好，最近怎么样");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "casual");
  });

  it("falls back to casual with low confidence for unrecognized input", () => {
    const result = classifyStimulus("量子纠缠的本质是什么");
    // Should get intellectual or casual
    assert.ok(result.length > 0);
    assert.ok(result[0].confidence > 0);
  });

  it("returns empty-text fallback as casual", () => {
    const result = classifyStimulus("");
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "casual");
    assert.equal(result[0].confidence, 0.3);
  });

  it("returns multiple matches sorted by confidence", () => {
    // This message has both praise and validation patterns
    const result = classifyStimulus("太棒了，你说得对");
    assert.ok(result.length >= 2);
    // Should be sorted descending
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].confidence >= result[i].confidence);
    }
  });

  it("boosts confidence for multiple pattern matches", () => {
    // Multiple praise patterns
    const result = classifyStimulus("太棒了，好厉害，amazing");
    const praise = result.find((r) => r.type === "praise");
    assert.ok(praise);
    assert.ok(praise.confidence > 0.8, `confidence ${praise.confidence} should be > 0.8`);
  });

  it("caps confidence at 0.95", () => {
    // Hit many patterns to push confidence high
    const result = classifyStimulus("好厉害太棒了真不错太强了佩服优秀完美amazing awesome");
    const praise = result.find((r) => r.type === "praise");
    assert.ok(praise);
    assert.ok(praise.confidence <= 0.95);
  });

  it("handles English case-insensitively", () => {
    const lower = classifyStimulus("AMAZING work, GREAT JOB");
    const praise = lower.find((r) => r.type === "praise");
    assert.ok(praise);
  });

  it("detects emoji-based patterns", () => {
    const result = classifyStimulus("😂🤣");
    const humor = result.find((r) => r.type === "humor");
    assert.ok(humor);
  });
});

// ── getPrimaryStimulus ──────────────────────────────────────

describe("getPrimaryStimulus", () => {
  it("returns the highest-confidence type", () => {
    assert.equal(getPrimaryStimulus("太棒了"), "praise");
    assert.equal(getPrimaryStimulus("这不对，有bug"), "criticism");
    assert.equal(getPrimaryStimulus("哈哈"), "humor");
  });

  it("returns casual for neutral input", () => {
    const result = getPrimaryStimulus("abcdef12345");
    assert.equal(result, "casual");
  });
});
