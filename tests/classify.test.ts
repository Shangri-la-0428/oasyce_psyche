import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyStimulus, getPrimaryStimulus, scoreSentiment, scoreEmoji, detectSarcasmSignals,
  analyzeParticles, detectIntent, BuiltInClassifier, buildLLMClassifierPrompt, parseLLMClassification,
} from "../src/classify.js";
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

// ── Enhanced classifier: sentiment helpers ──────────────────

describe("scoreSentiment", () => {
  it("detects positive Chinese sentiment", () => {
    const s = scoreSentiment("我今天好开心");
    assert.ok(s.positive > 0, `positive ${s.positive} should be > 0`);
  });

  it("detects negative Chinese sentiment", () => {
    const s = scoreSentiment("好累啊");
    assert.ok(s.negative > 0, `negative ${s.negative} should be > 0`);
  });

  it("detects intimate words", () => {
    const s = scoreSentiment("我想你，好珍惜");
    assert.ok(s.intimate > 0, `intimate ${s.intimate} should be > 0`);
  });

  it("detects English sentiment", () => {
    const s = scoreSentiment("I'm so happy and excited");
    assert.ok(s.positive > 0, `positive ${s.positive} should be > 0`);
  });

  it("returns zeros for neutral text", () => {
    const s = scoreSentiment("abcdef12345");
    assert.equal(s.positive, 0);
    assert.equal(s.negative, 0);
    assert.equal(s.intimate, 0);
  });
});

describe("scoreEmoji", () => {
  it("scores positive emoji", () => {
    assert.ok(scoreEmoji("😊😄") > 0);
  });

  it("scores negative emoji", () => {
    assert.ok(scoreEmoji("😢😭") < 0);
  });

  it("returns 0 for no emoji", () => {
    assert.equal(scoreEmoji("hello world"), 0);
  });

  it("balances mixed emoji", () => {
    const score = scoreEmoji("😊😭");
    assert.ok(Math.abs(score) <= 0.01, `mixed emoji should be near zero, got ${score}`);
  });
});

// ── Enhanced classifier: multi-signal scoring ───────────────

describe("classifyStimulus — enhanced multi-signal fallback", () => {
  it("classifies positive sentiment without keyword match", () => {
    // "我今天好开心" has positive sentiment words but no keyword rule match
    const result = classifyStimulus("我今天好开心");
    assert.ok(result.length > 0);
    const types = result.map(r => r.type);
    assert.ok(
      types.includes("praise") || types.includes("validation"),
      `Expected praise or validation in [${types}]`,
    );
    assert.ok(result[0].confidence >= 0.35, `confidence ${result[0].confidence} should be >= 0.35`);
  });

  it("classifies negative + ellipsis as vulnerability", () => {
    // "好累啊..." — negative word + ellipsis should push toward vulnerability
    const result = classifyStimulus("好累啊...");
    assert.ok(result.length > 0);
    const vuln = result.find(r => r.type === "vulnerability");
    assert.ok(vuln, `Should detect vulnerability in [${result.map(r => r.type)}]`);
  });

  it("classifies crying emoji as vulnerability/neglect", () => {
    const result = classifyStimulus("😭");
    assert.ok(result.length > 0);
    const types = result.map(r => r.type);
    assert.ok(
      types.includes("vulnerability") || types.includes("neglect"),
      `Expected vulnerability or neglect for crying emoji, got [${types}]`,
    );
  });

  it("does not incorrectly classify ultra-short neutral input", () => {
    // "嗯" — very short, should not get high confidence on anything unexpected
    const result = classifyStimulus("嗯");
    assert.ok(result.length > 0);
    // Should be neglect or casual (short message signal), not vulnerability or praise
    const primary = result[0].type;
    assert.ok(
      primary === "neglect" || primary === "casual",
      `Ultra-short "嗯" should be neglect or casual, got ${primary}`,
    );
  });

  it("classifies question about opinion reasonably", () => {
    // "你觉得呢？" — question + "你" → should get intellectual or casual
    const result = classifyStimulus("你觉得呢？");
    assert.ok(result.length > 0);
    const types = result.map(r => r.type);
    assert.ok(
      types.includes("intellectual") || types.includes("casual"),
      `Expected intellectual or casual for "你觉得呢？", got [${types}]`,
    );
  });

  it("classifies happy emoji message as praise/humor", () => {
    const result = classifyStimulus("😊👍");
    assert.ok(result.length > 0);
    const types = result.map(r => r.type);
    assert.ok(
      types.includes("praise") || types.includes("humor"),
      `Expected praise or humor for happy emoji, got [${types}]`,
    );
  });

  it("classifies English negative sentiment via scoring", () => {
    const result = classifyStimulus("I feel so sad and tired today");
    assert.ok(result.length > 0);
    const vuln = result.find(r => r.type === "vulnerability");
    assert.ok(vuln, `Should detect vulnerability, got [${result.map(r => r.type)}]`);
  });

  it("classifies intimate message via scoring", () => {
    const result = classifyStimulus("I miss you, please stay close");
    assert.ok(result.length > 0);
    const types = result.map(r => r.type);
    assert.ok(
      types.includes("intimacy"),
      `Expected intimacy for intimate message, got [${types}]`,
    );
  });
});

// ── Contextual priming (recentStimuli) ──────────────────────

describe("classifyStimulus — contextual priming", () => {
  it("negative recent context nudges ambiguous message toward negative", () => {
    // Ambiguous message with slight negative sentiment
    const text = "唉算了吧";
    const withoutContext = classifyStimulus(text);
    const withNegContext = classifyStimulus(text, ["vulnerability", "criticism", "neglect"]);

    // With negative context, negative-leaning types should get a boost
    const negScoreWithout = withoutContext.find(r =>
      r.type === "vulnerability" || r.type === "criticism" || r.type === "neglect",
    )?.confidence ?? 0;
    const negScoreWith = withNegContext.find(r =>
      r.type === "vulnerability" || r.type === "criticism" || r.type === "neglect",
    )?.confidence ?? 0;
    assert.ok(
      negScoreWith >= negScoreWithout,
      `Negative context should boost negative scores: ${negScoreWith} >= ${negScoreWithout}`,
    );
  });

  it("neutral recent context does not affect scoring", () => {
    const text = "今天天气不错";
    const withoutContext = classifyStimulus(text);
    const withNeutralContext = classifyStimulus(text, ["casual", "casual", "praise"]);
    // Should produce similar primary results
    assert.equal(withoutContext[0].type, withNeutralContext[0].type);
  });

  it("handles null entries in recentStimuli gracefully", () => {
    const text = "有点无聊";
    const result = classifyStimulus(text, [null, "casual", null]);
    assert.ok(result.length > 0);
  });

  it("handles empty recentStimuli array", () => {
    const text = "有点无聊";
    const result = classifyStimulus(text, []);
    assert.ok(result.length > 0);
  });
});

// ── Regression: existing keyword matches still work with new signature ──

describe("classifyStimulus — backward compatibility", () => {
  it("keyword matches still work with recentStimuli parameter", () => {
    const result = classifyStimulus("太棒了，好厉害", ["casual"]);
    const praise = result.find(r => r.type === "praise");
    assert.ok(praise, "Keyword-based praise should still match with recentStimuli");
    assert.ok(praise.confidence >= 0.8);
  });

  it("empty text still returns casual 0.3 with recentStimuli", () => {
    const result = classifyStimulus("", ["vulnerability"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "casual");
    assert.equal(result[0].confidence, 0.3);
  });
});

// ── detectSarcasmSignals ────────────────────────────────────

describe("detectSarcasmSignals", () => {
  it("detects Chinese sarcasm pattern '你真行啊'", () => {
    const score = detectSarcasmSignals("你真行啊");
    assert.ok(score > 0, `score ${score} should be > 0`);
  });

  it("detects Chinese sarcasm pattern '厉害了'", () => {
    const score = detectSarcasmSignals("厉害了");
    assert.ok(score > 0, `score ${score} should be > 0`);
  });

  it("detects English sarcasm pattern 'oh really'", () => {
    const score = detectSarcasmSignals("oh really");
    assert.ok(score > 0, `score ${score} should be > 0`);
  });

  it("detects English sarcasm pattern 'yeah right'", () => {
    const score = detectSarcasmSignals("yeah right");
    assert.ok(score > 0, `score ${score} should be > 0`);
  });

  it("gives bonus score to short text with praise word '厉害'", () => {
    const score = detectSarcasmSignals("厉害");
    assert.ok(score > 0, `score ${score} should be > 0`);
    // Short text (< 15 chars) with praise word gets extra 0.15 bonus
    assert.ok(score >= 0.15, `score ${score} should be >= 0.15 (short-text bonus)`);
  });

  it("returns 0 for empty text", () => {
    const score = detectSarcasmSignals("");
    assert.equal(score, 0);
  });

  it("scores low for normal genuine praise", () => {
    const score = detectSarcasmSignals("你做得真的很好，我很佩服你的努力");
    assert.ok(score < 0.3, `genuine praise score ${score} should be < 0.3`);
  });

  it("boosts score when recent context is negative", () => {
    const text = "好棒";
    const withoutContext = detectSarcasmSignals(text);
    const withNegContext = detectSarcasmSignals(text, ["criticism", "conflict"]);
    assert.ok(
      withNegContext > withoutContext,
      `negative context score ${withNegContext} should be > no-context score ${withoutContext}`,
    );
  });

  it("detects ambiguous word '呵呵' as sarcasm signal", () => {
    const score = detectSarcasmSignals("呵呵");
    assert.ok(score > 0, `'呵呵' score ${score} should be > 0`);
  });
});

// ── Sarcasm reclassification in classifyStimulus ────────────

describe("classifyStimulus — sarcasm reclassification", () => {
  it("reclassifies '你真棒啊，厉害了' as sarcasm instead of praise", () => {
    // Matches praise keywords (真棒, 厉害) but sarcasm patterns (你真棒啊, 厉害了) push it over 0.4
    const result = classifyStimulus("你真棒啊，厉害了");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "sarcasm", `expected sarcasm, got ${result[0].type}`);
  });

  it("reclassifies '你真棒' toward sarcasm with heavy negative context", () => {
    const result = classifyStimulus("你真棒", ["criticism", "criticism", "conflict"]);
    assert.ok(result.length > 0);
    const sarcasm = result.find(r => r.type === "sarcasm");
    assert.ok(sarcasm, `expected sarcasm in [${result.map(r => r.type)}]`);
  });

  it("keeps genuine long praise as praise (not reclassified)", () => {
    // Longer text avoids the short-text sarcasm bonus, and no sarcasm patterns match
    const result = classifyStimulus("你做得太棒了，真的非常佩服你的努力和坚持，继续加油");
    assert.ok(result.length > 0);
    assert.equal(result[0].type, "praise", `expected praise, got ${result[0].type}`);
  });
});

// ── Ambiguous word handling ─────────────────────────────────

describe("classifyStimulus — ambiguous sarcasm words", () => {
  it("classifies '呵呵' alone as sarcasm or neglect", () => {
    const result = classifyStimulus("呵呵");
    assert.ok(result.length > 0);
    const primary = result[0].type;
    assert.ok(
      primary === "sarcasm" || primary === "neglect",
      `expected sarcasm or neglect for '呵呵', got ${primary}`,
    );
  });

  it("classifies 'ok' alone without crashing and produces a result", () => {
    const result = classifyStimulus("ok");
    assert.ok(result.length > 0);
    assert.ok(result[0].confidence > 0, `confidence should be > 0`);
  });
});

// ── v9.1: Short message dictionary ────────────────────────────

describe("short message dictionary (v9.1)", () => {
  it("'对' classifies as validation", () => {
    const result = classifyStimulus("对");
    assert.equal(result[0].type, "validation");
    assert.ok(result[0].confidence >= 0.5, `confidence ${result[0].confidence} should be >= 0.5`);
  });

  it("'累了' classifies as vulnerability", () => {
    const result = classifyStimulus("累了");
    assert.equal(result[0].type, "vulnerability");
    assert.ok(result[0].confidence >= 0.5);
  });

  it("'666' classifies as praise", () => {
    const result = classifyStimulus("666");
    assert.equal(result[0].type, "praise");
    assert.ok(result[0].confidence >= 0.5);
  });

  it("'无语' classifies as neglect", () => {
    const result = classifyStimulus("无语");
    assert.equal(result[0].type, "neglect");
    assert.ok(result[0].confidence >= 0.5);
  });

  it("'哈哈哈' classifies as humor", () => {
    const result = classifyStimulus("哈哈哈");
    assert.equal(result[0].type, "humor");
    assert.ok(result[0].confidence >= 0.5);
  });

  it("'确实' classifies as validation", () => {
    const result = classifyStimulus("确实");
    assert.equal(result[0].type, "validation");
    assert.ok(result[0].confidence >= 0.5);
  });
});

// ── v9.1: Particle analysis ──────────────────────────────────

describe("analyzeParticles (v9.1)", () => {
  it("warm particles (啊/呀/啦) give positive warmth", () => {
    const r = analyzeParticles("好厉害啊");
    assert.ok(r.warmth > 0, `warmth ${r.warmth} should be > 0`);
  });

  it("cold particles (哦) give negative warmth", () => {
    const r = analyzeParticles("好吧哦");
    assert.ok(r.warmth < 0, `warmth ${r.warmth} should be < 0`);
  });

  it("uncertain particle (吧) gives negative certainty", () => {
    const r = analyzeParticles("还行吧");
    assert.ok(r.certainty < 0, `certainty ${r.certainty} should be < 0`);
  });

  it("no particles returns near-zero signal", () => {
    const r = analyzeParticles("你好");
    assert.ok(Math.abs(r.warmth) <= 0.1);
    assert.ok(Math.abs(r.certainty) <= 0.1);
  });
});

// ── v9.1: Intent detection ───────────────────────────────────

describe("detectIntent (v9.1)", () => {
  it("Chinese request pattern → request", () => {
    const r = detectIntent("能不能帮我查一下");
    assert.equal(r.intent, "request");
    assert.ok(r.confidence >= 0.5);
  });

  it("English request pattern → request", () => {
    const r = detectIntent("can you help me with this");
    assert.equal(r.intent, "request");
    assert.ok(r.confidence >= 0.5);
  });

  it("agreement word → agreement", () => {
    const r = detectIntent("是的");
    assert.equal(r.intent, "agreement");
    assert.ok(r.confidence >= 0.5);
  });

  it("disagreement → disagreement", () => {
    const r = detectIntent("不是吧");
    assert.equal(r.intent, "disagreement");
    assert.ok(r.confidence >= 0.5);
  });

  it("greeting → greeting", () => {
    const r = detectIntent("你好");
    assert.equal(r.intent, "greeting");
    assert.ok(r.confidence >= 0.5);
  });

  it("emotional expression → emotional", () => {
    const r = detectIntent("我好难过");
    assert.equal(r.intent, "emotional");
    assert.ok(r.confidence >= 0.5);
  });
});

// ── v9.1: Expanded rules ─────────────────────────────────────

describe("expanded classification rules (v9.1)", () => {
  it("'你说的对' classifies as validation", () => {
    const result = classifyStimulus("你说的对");
    assert.ok(result.some(r => r.type === "validation"), `should detect validation in '你说的对'`);
  });

  it("'学到了' classifies as praise", () => {
    const result = classifyStimulus("学到了，受教");
    assert.ok(result.some(r => r.type === "praise"), `should detect praise`);
  });

  it("'不知道该怎么办' classifies as vulnerability", () => {
    const result = classifyStimulus("我不知道该怎么办了");
    assert.ok(result.some(r => r.type === "vulnerability"), `should detect vulnerability`);
  });

  it("'能帮我看看吗' classifies as authority", () => {
    const result = classifyStimulus("能帮我看看吗");
    assert.ok(result.some(r => r.type === "authority"), `should detect authority (request)`);
  });

  it("'在干嘛' classifies as casual", () => {
    const result = classifyStimulus("在干嘛");
    assert.ok(result.some(r => r.type === "casual"), `should detect casual`);
  });

  it("'I see, makes sense' classifies as validation", () => {
    const result = classifyStimulus("I see, makes sense");
    assert.ok(result.some(r => r.type === "validation"), `should detect validation`);
  });

  it("'feeling overwhelmed' classifies as vulnerability", () => {
    const result = classifyStimulus("I'm feeling overwhelmed right now");
    assert.ok(result.some(r => r.type === "vulnerability"), `should detect vulnerability`);
  });

  it("'能解释一下吗' classifies as intellectual", () => {
    const result = classifyStimulus("能解释一下这个概念吗");
    assert.ok(result.some(r => r.type === "intellectual"), `should detect intellectual`);
  });
});

// ── v9.1: BuiltInClassifier wrapper ──────────────────────────

describe("BuiltInClassifier (v9.1)", () => {
  it("implements ClassifierProvider and returns same results as classifyStimulus", () => {
    const classifier = new BuiltInClassifier();
    const raw = classifyStimulus("太棒了");
    const wrapped = classifier.classify("太棒了");
    assert.ok(!Array.isArray(wrapped) || wrapped.length > 0);
    assert.deepEqual(wrapped, raw);
  });

  it("passes context through to classifyStimulus", () => {
    const classifier = new BuiltInClassifier();
    const result = classifier.classify("好", { recentStimuli: ["criticism"] });
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });
});

// ── v9.1: LLM classifier prompt and parser ──────────────────

describe("parseLLMClassification (v9.1)", () => {
  it("parses valid JSON response", () => {
    const r = parseLLMClassification('{"type":"praise","confidence":0.8}');
    assert.ok(r);
    assert.equal(r!.type, "praise");
    assert.equal(r!.confidence, 0.8);
  });

  it("handles markdown code blocks", () => {
    const r = parseLLMClassification('```json\n{"type":"criticism","confidence":0.7}\n```');
    assert.ok(r);
    assert.equal(r!.type, "criticism");
  });

  it("returns null for garbage input", () => {
    const r = parseLLMClassification("I think this is a happy message");
    assert.equal(r, null);
  });

  it("validates stimulus type", () => {
    const r = parseLLMClassification('{"type":"nonexistent","confidence":0.8}');
    assert.equal(r, null);
  });

  it("clamps confidence to 0.95 max", () => {
    const r = parseLLMClassification('{"type":"praise","confidence":1.5}');
    assert.ok(r);
    assert.ok(r!.confidence <= 0.95);
  });
});

// ── Boundary tests ───────────────────────────────────────────

describe("classifier boundary cases", () => {
  it("pure punctuation produces a result without crashing", () => {
    const r = classifyStimulus("？？？");
    assert.ok(r.length > 0);
  });

  it("pure exclamation marks classify as surprise or casual", () => {
    const r = classifyStimulus("！！！");
    assert.ok(r.length > 0);
    assert.ok(
      r[0].type === "surprise" || r[0].type === "casual",
      `expected surprise or casual, got ${r[0].type}`,
    );
  });

  it("mixed Chinese-English short message works", () => {
    const r = classifyStimulus("ok棒");
    assert.ok(r.length > 0);
    assert.ok(r[0].confidence > 0);
  });

  it("very long message (500+ chars) doesn't crash", () => {
    const long = "我今天遇到了一件事情，".repeat(50);
    const r = classifyStimulus(long);
    assert.ok(r.length > 0);
  });

  it("pure emoji message classifies via emoji scoring", () => {
    const r = classifyStimulus("😭😭😭");
    assert.ok(r.length > 0);
    assert.ok(
      r[0].type === "vulnerability" || r[0].type === "neglect",
      `expected vulnerability or neglect for sad emoji, got ${r[0].type}`,
    );
  });

  it("whitespace-only string treated like empty", () => {
    const r = classifyStimulus("   \n  ");
    assert.ok(r.length > 0);
    assert.equal(r[0].type, "casual");
  });

  it("single Chinese character '好' classifies without error", () => {
    const r = classifyStimulus("好");
    assert.ok(r.length > 0);
    assert.ok(r[0].confidence > 0);
  });

  it("number-only messages like '111' don't crash", () => {
    const r = classifyStimulus("111");
    assert.ok(r.length > 0);
  });
});
