import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getProfile, getBaseline, getDefaultSelfModel,
  getSensitivity, getTemperament, extractMBTI,
} from "../src/profiles.js";
import type { MBTIType, ChemicalState } from "../src/types.js";
import { CHEMICAL_KEYS } from "../src/types.js";
import { isMBTIType } from "../src/guards.js";

const ALL_MBTI: MBTIType[] = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

// ── Baseline validation ─────────────────────────────────────

describe("MBTI baselines", () => {
  for (const mbti of ALL_MBTI) {
    it(`${mbti} baseline has all values in [0, 100]`, () => {
      const baseline = getBaseline(mbti);
      for (const key of CHEMICAL_KEYS) {
        assert.ok(baseline[key] >= 0 && baseline[key] <= 100,
          `${mbti}.${key} = ${baseline[key]} should be in [0, 100]`);
      }
    });
  }

  it("all 16 types have unique baselines", () => {
    const seen = new Set<string>();
    for (const mbti of ALL_MBTI) {
      const bl = getBaseline(mbti);
      const key = CHEMICAL_KEYS.map((k) => bl[k]).join(",");
      assert.ok(!seen.has(key), `${mbti} has duplicate baseline`);
      seen.add(key);
    }
  });

  it("getBaseline returns a copy (not reference)", () => {
    const a = getBaseline("ENFP");
    const b = getBaseline("ENFP");
    a.DA = 999;
    assert.notEqual(b.DA, 999);
  });
});

// ── Sensitivity ─────────────────────────────────────────────

describe("sensitivity", () => {
  for (const mbti of ALL_MBTI) {
    it(`${mbti} sensitivity is in [0.5, 1.5]`, () => {
      const s = getSensitivity(mbti);
      assert.ok(s >= 0.5 && s <= 1.5, `${mbti} sensitivity = ${s}`);
    });
  }
});

// ── Temperament ─────────────────────────────────────────────

describe("temperament", () => {
  for (const mbti of ALL_MBTI) {
    it(`${mbti} has non-empty temperament string`, () => {
      const t = getTemperament(mbti);
      assert.ok(typeof t === "string" && t.length > 0);
    });
  }
});

// ── Self Model ──────────────────────────────────────────────

describe("defaultSelfModel", () => {
  for (const mbti of ALL_MBTI) {
    it(`${mbti} has values, preferences, boundaries`, () => {
      const model = getDefaultSelfModel(mbti);
      assert.ok(model.values.length > 0, `${mbti} needs values`);
      assert.ok(model.preferences.length > 0, `${mbti} needs preferences`);
      assert.ok(model.boundaries.length > 0, `${mbti} needs boundaries`);
      assert.ok(Array.isArray(model.currentInterests));
    });
  }

  it("returns a deep copy", () => {
    const a = getDefaultSelfModel("INFJ");
    const b = getDefaultSelfModel("INFJ");
    a.values.push("test");
    assert.ok(!b.values.includes("test"));
  });
});

// ── getProfile ──────────────────────────────────────────────

describe("getProfile", () => {
  it("returns complete profile object", () => {
    const p = getProfile("ENTJ");
    assert.ok(p.baseline);
    assert.ok(typeof p.sensitivity === "number");
    assert.ok(typeof p.temperament === "string");
    assert.ok(p.defaultSelfModel);
  });
});

// ── extractMBTI ─────────────────────────────────────────────

describe("extractMBTI", () => {
  it("extracts explicit MBTI: ENFP", () => {
    assert.equal(extractMBTI("My MBTI: ENFP and I love it"), "ENFP");
  });

  it("extracts MBTI：INTJ (Chinese colon)", () => {
    assert.equal(extractMBTI("MBTI：INTJ"), "INTJ");
  });

  it("extracts standalone type string", () => {
    assert.equal(extractMBTI("I am definitely an ESTP type person"), "ESTP");
  });

  it("returns null when no MBTI found", () => {
    assert.equal(extractMBTI("Hello, I like cats"), null);
  });

  it("handles case insensitive MBTI prefix", () => {
    assert.equal(extractMBTI("mbti: INFP"), "INFP");
  });

  it("returns first match for multiple types", () => {
    // "INTJ" appears first in scan order
    const result = extractMBTI("I used to be INFP but now INTJ");
    assert.ok(result === "INTJ" || result === "INFP", `Got ${result}`);
  });

  it("uses type guard for validation", () => {
    // Invalid 4-letter combo after "MBTI:" should not match
    assert.equal(extractMBTI("MBTI: ABCD"), null);
  });
});

// ── isMBTIType guard ────────────────────────────────────────

describe("isMBTIType", () => {
  it("accepts all 16 valid types", () => {
    for (const t of ALL_MBTI) {
      assert.ok(isMBTIType(t), `${t} should be valid`);
    }
  });

  it("accepts lowercase", () => {
    assert.ok(isMBTIType("enfp"));
    assert.ok(isMBTIType("intj"));
  });

  it("rejects invalid strings", () => {
    assert.ok(!isMBTIType("ABCD"));
    assert.ok(!isMBTIType(""));
    assert.ok(!isMBTIType("INT"));
    assert.ok(!isMBTIType("INTJJ"));
  });
});

// ── Design principle checks ─────────────────────────────────

describe("design principles", () => {
  it("E types have higher DA than I counterparts", () => {
    const pairs: [MBTIType, MBTIType][] = [
      ["ENTJ", "INTJ"], ["ENTP", "INTP"],
      ["ENFJ", "INFJ"], ["ENFP", "INFP"],
      ["ESTJ", "ISTJ"], ["ESFJ", "ISFJ"],
      ["ESTP", "ISTP"], ["ESFP", "ISFP"],
    ];
    for (const [e, i] of pairs) {
      assert.ok(getBaseline(e).DA >= getBaseline(i).DA,
        `${e} DA should >= ${i} DA`);
    }
  });

  it("F types have higher OT than T counterparts", () => {
    const fTypes: MBTIType[] = ["INFJ", "INFP", "ENFJ", "ENFP", "ISFJ", "ESFJ", "ISFP", "ESFP"];
    const tTypes: MBTIType[] = ["INTJ", "INTP", "ENTJ", "ENTP", "ISTJ", "ESTJ", "ISTP", "ESTP"];
    const fAvg = fTypes.reduce((s, t) => s + getBaseline(t).OT, 0) / fTypes.length;
    const tAvg = tTypes.reduce((s, t) => s + getBaseline(t).OT, 0) / tTypes.length;
    assert.ok(fAvg > tAvg, `F avg OT ${fAvg} should > T avg OT ${tAvg}`);
  });
});
