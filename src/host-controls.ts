// ============================================================
// Host Controls — derive mechanical generation constraints
//
// Maps psyche output into a tiny host-consumable control surface.
// ============================================================

import type { GenerationControls, PolicyModifiers, ResponseContract } from "./types.js";

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function estimateMaxTokens(contract?: ResponseContract): number | undefined {
  if (!contract) return undefined;

  let budget: number;
  if (contract.maxChars !== undefined) {
    budget = clampInt(contract.maxChars * 2.2, 64, 1024);
  } else if (contract.expressionMode === "brief") {
    budget = 96;
  } else if (contract.expressionMode === "expansive") {
    budget = 640;
  } else {
    budget = 256;
  }

  if (contract.maxSentences <= 1) budget = Math.min(budget, 96);
  else if (contract.maxSentences === 2) budget = Math.min(budget, 160);
  else if (contract.maxSentences === 3) budget = Math.min(budget, 320);

  if (contract.initiativeMode === "reactive") {
    budget = clampInt(budget * 0.85, 64, 1024);
  }

  return budget;
}

export function deriveGenerationControls(
  input: {
    responseContract?: ResponseContract;
    policyModifiers?: Pick<PolicyModifiers, "requireConfirmation">;
  },
  existingMaxTokens?: number,
): GenerationControls {
  const recommendedMax = estimateMaxTokens(input.responseContract);
  const maxTokens = recommendedMax !== undefined
    ? existingMaxTokens !== undefined
      ? Math.min(existingMaxTokens, recommendedMax)
      : recommendedMax
    : existingMaxTokens;

  return {
    maxTokens,
    requireConfirmation: input.policyModifiers?.requireConfirmation
      ?? (input.responseContract?.boundaryMode === "confirm-first"),
  };
}
