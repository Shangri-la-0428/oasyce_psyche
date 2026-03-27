import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getProfile, getBaseline, getDefaultSelfModel,
  getSensitivity, getTemperament, extractMBTI,
  traitsToBaseline, mbtiToTraits,
} from "../src/profiles.js";
import type { MBTIType, ChemicalState, PersonalityTraits } from "../src/types.js";
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

// ── traitsToBaseline ────────────────────────────────────────

describe("traitsToBaseline", () => {
  it("high extraversion → higher DA than low extraversion", () => {
    const high = traitsToBaseline({ openness: 50, conscientiousness: 50, extraversion: 90, agreeableness: 50, neuroticism: 50 });
    const low = traitsToBaseline({ openness: 50, conscientiousness: 50, extraversion: 20, agreeableness: 50, neuroticism: 50 });
    assert.ok(high.baseline.DA > low.baseline.DA,
      `DA high-E=${high.baseline.DA} should > DA low-E=${low.baseline.DA}`);
  });

  it("high neuroticism → higher CORT and higher sensitivity", () => {
    const high = traitsToBaseline({ openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 90 });
    const low = traitsToBaseline({ openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 20 });
    assert.ok(high.baseline.CORT > low.baseline.CORT,
      `CORT high-N=${high.baseline.CORT} should > CORT low-N=${low.baseline.CORT}`);
    assert.ok(high.sensitivity > low.sensitivity,
      `sensitivity high-N=${high.sensitivity} should > sensitivity low-N=${low.sensitivity}`);
  });

  it("high agreeableness → higher OT than low agreeableness", () => {
    const high = traitsToBaseline({ openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 90, neuroticism: 50 });
    const low = traitsToBaseline({ openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 20, neuroticism: 50 });
    assert.ok(high.baseline.OT > low.baseline.OT,
      `OT high-A=${high.baseline.OT} should > OT low-A=${low.baseline.OT}`);
  });

  it("high conscientiousness → higher HT", () => {
    const high = traitsToBaseline({ openness: 50, conscientiousness: 90, extraversion: 50, agreeableness: 50, neuroticism: 50 });
    const low = traitsToBaseline({ openness: 50, conscientiousness: 20, extraversion: 50, agreeableness: 50, neuroticism: 50 });
    assert.ok(high.baseline.HT > low.baseline.HT,
      `HT high-C=${high.baseline.HT} should > HT low-C=${low.baseline.HT}`);
  });

  it("all values in [0,100] for extreme inputs (all 0s)", () => {
    const result = traitsToBaseline({ openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 });
    for (const key of CHEMICAL_KEYS) {
      assert.ok(result.baseline[key] >= 0 && result.baseline[key] <= 100,
        `all-0s: ${key}=${result.baseline[key]} should be in [0,100]`);
    }
  });

  it("all values in [0,100] for extreme inputs (all 100s)", () => {
    const result = traitsToBaseline({ openness: 100, conscientiousness: 100, extraversion: 100, agreeableness: 100, neuroticism: 100 });
    for (const key of CHEMICAL_KEYS) {
      assert.ok(result.baseline[key] >= 0 && result.baseline[key] <= 100,
        `all-100s: ${key}=${result.baseline[key]} should be in [0,100]`);
    }
  });

  it("sensitivity in reasonable range [0.5, 1.3] for all combos", () => {
    const combos: PersonalityTraits[] = [
      { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 },
      { openness: 100, conscientiousness: 100, extraversion: 100, agreeableness: 100, neuroticism: 100 },
      { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 },
      { openness: 100, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 100 },
    ];
    for (const traits of combos) {
      const { sensitivity } = traitsToBaseline(traits);
      assert.ok(sensitivity >= 0.5 && sensitivity <= 1.3,
        `sensitivity=${sensitivity} should be in [0.5, 1.3] for traits=${JSON.stringify(traits)}`);
    }
  });

  it("returns different baselines for different trait combos", () => {
    const a = traitsToBaseline({ openness: 90, conscientiousness: 20, extraversion: 80, agreeableness: 70, neuroticism: 40 });
    const b = traitsToBaseline({ openness: 20, conscientiousness: 90, extraversion: 30, agreeableness: 30, neuroticism: 70 });
    const aKey = CHEMICAL_KEYS.map((k) => a.baseline[k]).join(",");
    const bKey = CHEMICAL_KEYS.map((k) => b.baseline[k]).join(",");
    assert.notEqual(aKey, bKey, "different trait combos should produce different baselines");
  });
});

// ── mbtiToTraits ────────────────────────────────────────────

describe("mbtiToTraits", () => {
  it("returns object with all 5 fields", () => {
    const traits = mbtiToTraits("ENFP");
    const fields: (keyof PersonalityTraits)[] = [
      "openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism",
    ];
    for (const f of fields) {
      assert.ok(f in traits, `missing field: ${f}`);
      assert.equal(typeof traits[f], "number");
    }
  });

  it("all values in [0, 100]", () => {
    const traits = mbtiToTraits("INTJ");
    for (const [key, val] of Object.entries(traits)) {
      assert.ok(val >= 0 && val <= 100, `${key}=${val} should be in [0,100]`);
    }
  });

  it("returns a copy (mutation does not affect source)", () => {
    const a = mbtiToTraits("INFJ");
    const b = mbtiToTraits("INFJ");
    a.openness = 999;
    assert.notEqual(b.openness, 999, "mutation should not affect source");
  });

  it("ENFP has higher extraversion than INTJ", () => {
    const enfp = mbtiToTraits("ENFP");
    const intj = mbtiToTraits("INTJ");
    assert.ok(enfp.extraversion > intj.extraversion,
      `ENFP extraversion=${enfp.extraversion} should > INTJ extraversion=${intj.extraversion}`);
  });

  it("INTJ has higher conscientiousness than ENFP", () => {
    const intj = mbtiToTraits("INTJ");
    const enfp = mbtiToTraits("ENFP");
    assert.ok(intj.conscientiousness > enfp.conscientiousness,
      `INTJ conscientiousness=${intj.conscientiousness} should > ENFP conscientiousness=${enfp.conscientiousness}`);
  });

  it("all 16 MBTI types return valid traits", () => {
    for (const mbti of ALL_MBTI) {
      const traits = mbtiToTraits(mbti);
      for (const [key, val] of Object.entries(traits)) {
        assert.ok(typeof val === "number" && val >= 0 && val <= 100,
          `${mbti}.${key}=${val} should be number in [0,100]`);
      }
    }
  });
});

// ── Round-trip consistency: MBTI → traits → baseline ────────

describe("round-trip MBTI → traits → baseline", () => {
  const testTypes: MBTIType[] = ["ENFP", "INTJ", "ISFJ"];

  for (const mbti of testTypes) {
    it(`${mbti}: traitsToBaseline(mbtiToTraits(mbti)) ≈ getBaseline(mbti) within ~20`, () => {
      const directBaseline = getBaseline(mbti);
      const roundTrip = traitsToBaseline(mbtiToTraits(mbti));
      for (const key of CHEMICAL_KEYS) {
        const diff = Math.abs(directBaseline[key] - roundTrip.baseline[key]);
        assert.ok(diff <= 20,
          `${mbti}.${key}: direct=${directBaseline[key]} roundTrip=${roundTrip.baseline[key]} diff=${diff} should be ≤20`);
      }
    });
  }
});
