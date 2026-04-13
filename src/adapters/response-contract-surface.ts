import type { ProcessInputResult } from "../core.js";
import { buildResponseContractContext } from "../response-contract.js";
import type { Locale, ResponseContract } from "../types.js";

export function resolveCanonicalResponseContract(
  result: Pick<ProcessInputResult, "replyEnvelope" | "responseContract">,
): ResponseContract | null {
  return result.replyEnvelope?.responseContract ?? result.responseContract ?? null;
}

export function renderProxyBehavioralSurface(contract: ResponseContract, locale: Locale): string {
  const context = buildResponseContractContext(contract, locale);
  return locale === "zh"
    ? `[代理行为契约]\n${context}`
    : `[Proxy Behavioral Contract]\n${context}`;
}

export function renderOpenClawBehavioralSurface(contract: ResponseContract, locale: Locale): string {
  const context = buildResponseContractContext(contract, locale);
  return locale === "zh"
    ? `[OpenClaw 行为契约]\n${context}`
    : `[OpenClaw Behavioral Contract]\n${context}`;
}
