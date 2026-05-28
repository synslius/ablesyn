import type { AbleClaim, AbleDocument } from "./types.ts";

export type TranslationTarget = "en" | "zh";

export function translateDocument(document: AbleDocument, target: TranslationTarget = "en"): string {
  return document.claims.map((claim) => translateClaim(claim, target)).join("\n\n");
}

export function translateClaim(claim: AbleClaim, target: TranslationTarget = "en"): string {
  if (target === "zh") {
    return renderZh(claim);
  }
  return renderEn(claim);
}

function renderEn(claim: AbleClaim): string {
  const lines = [
    `Claim: ${claim.title ?? claim.id} (${claim.id})`,
    `Layer: ${claim.layer ?? "UNKNOWN"}`,
    `Affordance: ${joinOrNone(claim.affordance)}`,
    `Belief: ${formatConfidence(claim.belief.confidence)}; sources ${joinOrNone(claim.belief.sources)}`,
    `Limits: hard ${joinOrNone(claim.limit.hard)}; soft ${joinOrNone(claim.limit.soft)}; unknown ${joinOrNone(claim.limit.unknown)}`,
    `Evidence: ${joinOrNone(claim.evidence.map((entry) => `${entry.kind}:${entry.args.join("/")}`))}`,
    `Probe: ${joinOrNone(claim.probe.next)}`,
    `Verdict: ${claim.verdict?.status ?? "UNKNOWN"}${formatReasons(claim.verdict?.reasons)}`
  ];

  if (claim.frame) {
    lines.splice(
      2,
      0,
      `Frame: ${claim.frame.id ?? "unnamed"}; quote ${claim.frame.quote ?? "none"}; not evidence ${String(claim.frame.not_evidence ?? false)}`
    );
  }

  return lines.join("\n");
}

function renderZh(claim: AbleClaim): string {
  const lines = [
    `主张: ${claim.title ?? claim.id} (${claim.id})`,
    `层: ${claim.layer ?? "UNKNOWN"}`,
    `能力: ${joinOrNone(claim.affordance)}`,
    `信念: ${formatConfidence(claim.belief.confidence)}; 来源 ${joinOrNone(claim.belief.sources)}`,
    `边界: hard ${joinOrNone(claim.limit.hard)}; soft ${joinOrNone(claim.limit.soft)}; unknown ${joinOrNone(claim.limit.unknown)}`,
    `证据: ${joinOrNone(claim.evidence.map((entry) => `${entry.kind}:${entry.args.join("/")}`))}`,
    `探针: ${joinOrNone(claim.probe.next)}`,
    `结论: ${claim.verdict?.status ?? "UNKNOWN"}${formatReasons(claim.verdict?.reasons)}`
  ];

  if (claim.frame) {
    lines.splice(
      2,
      0,
      `框架: ${claim.frame.id ?? "unnamed"}; 原话 ${claim.frame.quote ?? "none"}; 不作证据 ${String(claim.frame.not_evidence ?? false)}`
    );
  }

  return lines.join("\n");
}

function formatConfidence(confidence: number | undefined): string {
  return confidence === undefined ? "unknown confidence" : `confidence ${confidence.toFixed(2)}`;
}

function formatReasons(reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) {
    return "";
  }
  return ` - ${reasons.join("; ")}`;
}

function joinOrNone(values: string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

