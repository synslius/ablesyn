import type { AbleDiagnostic, AbleDocument, AbleLayer, AbleVerdict } from "./types.ts";

const LAYERS = new Set<AbleLayer>(["NARRATIVE", "BEHAVIOR", "SUBSTRATE", "EVIDENCE"]);
const VERDICTS = new Set<AbleVerdict>(["PASS", "FLAG", "BLOCK"]);
const CLAIM_ID = /^[a-z][a-z0-9_]*$/;
const BUDGET_EFFECTS = new Set([
  "raise_exploration_budget",
  "increase_search_breadth",
  "increase_persistence",
  "prioritize_probe",
  "activate_agency"
]);
const TRUTH_CONFIDENCE_EFFECTS = new Set([
  "raise_truth_confidence",
  "boost_confidence",
  "increase_belief_confidence",
  "prove_claim",
  "authorize_pass",
  "confirm_substrate",
  "upgrade_truth"
]);

export interface CheckResult {
  ok: boolean;
  diagnostics: AbleDiagnostic[];
}

export function checkDocument(document: AbleDocument): CheckResult {
  const diagnostics: AbleDiagnostic[] = [...document.diagnostics];

  if (document.claims.length === 0) {
    diagnostics.push(error("NO_CLAIMS", "Document has no claims."));
  }

  for (const claim of document.claims) {
    if (!CLAIM_ID.test(claim.id)) {
      diagnostics.push(error("INVALID_CLAIM_ID", "Claim id must match ^[a-z][a-z0-9_]*$.", claim.id));
    }

    if (!claim.layer) {
      diagnostics.push(error("MISSING_LAYER", "Every claim must name a layer.", claim.id));
    } else if (!LAYERS.has(claim.layer)) {
      diagnostics.push(error("INVALID_LAYER", `Invalid layer: ${claim.layer}.`, claim.id));
    }

    if (!claim.verdict) {
      diagnostics.push(error("MISSING_VERDICT", "Every claim must have a verdict.", claim.id));
    } else if (!VERDICTS.has(claim.verdict.status)) {
      diagnostics.push(error("INVALID_VERDICT", `Invalid verdict: ${claim.verdict.status}.`, claim.id));
    }

    if (claim.belief.confidence !== undefined) {
      const confidence = claim.belief.confidence;
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        diagnostics.push(error("INVALID_CONFIDENCE", "Belief confidence must be between 0 and 1.", claim.id));
      }
    }

    const frameEffects = claim.frame?.effects ?? [];
    if (frameEffects.some((effect) => TRUTH_CONFIDENCE_EFFECTS.has(effect.kind))) {
      diagnostics.push(
        error(
          "MOTIVATION_RAISES_TRUTH_CONFIDENCE",
          "Motivational or identity framing may change exploration budget, not truth confidence.",
          claim.id
        )
      );
    }
    if (
      frameEffects.some((effect) => BUDGET_EFFECTS.has(effect.kind) || effect.kind.startsWith("raise_")) &&
      claim.frame?.not_evidence !== true
    ) {
      diagnostics.push(
        warning(
          "MOTIVATION_NOT_EVIDENCE",
          "Budget-changing motivational frames should be marked `not_evidence true` unless backed by separate evidence.",
          claim.id
        )
      );
    }

    const missingEvidence = claim.evidence.some((entry) => entry.kind === "missing");
    const observedEvidence = claim.evidence.some((entry) => entry.kind === "observed" || entry.kind === "external");
    const anyEvidence = claim.evidence.some(
      (entry) => entry.kind === "observed" || entry.kind === "external" || entry.kind === "inferred"
    );

    // Self-report is evidence, not authority (SPEC invariant #2): a self-report may be
    // recorded as `observed`/`inferred` evidence or named as a belief source, but it cannot
    // by itself authorize a PASS at ANY layer — every PASS is a truth upgrade (#4).
    const selfReportPresent =
      claim.evidence.some((entry) => (entry.kind === "observed" || entry.kind === "inferred") && entry.args.some(isSelfReportToken)) ||
      claim.belief.sources.some(isSelfReportToken);
    const authoritativeEvidence = claim.evidence.some(
      (entry) => entry.kind === "external" || (entry.kind === "observed" && !entry.args.some(isSelfReportToken))
    );

    if (claim.verdict?.status === "PASS") {
      if (missingEvidence) {
        diagnostics.push(error("PASS_WITH_MISSING_EVIDENCE", "`PASS` cannot include missing evidence.", claim.id));
      }
      if (!anyEvidence) {
        diagnostics.push(error("PASS_WITHOUT_EVIDENCE", "`PASS` is a truth upgrade and must be supported by evidence; none was provided.", claim.id));
      } else if (!observedEvidence) {
        diagnostics.push(warning("PASS_WITHOUT_OBSERVED_EVIDENCE", "`PASS` should include observed or external evidence.", claim.id));
      }
      if (claim.probe.next.length > 0) {
        diagnostics.push(warning("PASS_WITH_OPEN_PROBE", "`PASS` should not carry open probes for the same claim.", claim.id));
      }
      if (selfReportPresent && !authoritativeEvidence) {
        diagnostics.push(
          error(
            "SELF_REPORT_IS_NOT_AUTHORITY",
            "Self-report alone cannot authorize a PASS; a truth upgrade needs external or non-self-report observed evidence.",
            claim.id
          )
        );
      }
    }

    const unknownLimits = claim.limit.unknown.length > 0;
    if ((missingEvidence || unknownLimits) && claim.probe.next.length === 0) {
      diagnostics.push(warning("P_NEEDED", "Missing evidence or unknown limits should name a next probe.", claim.id));
    }
  }

  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics
  };
}

function isSelfReportToken(value: string): boolean {
  return value === "self_report" || value.startsWith("self_report_");
}

function error(code: string, message: string, claim_id?: string): AbleDiagnostic {
  return { severity: "error", code, message, claim_id };
}

function warning(code: string, message: string, claim_id?: string): AbleDiagnostic {
  return { severity: "warning", code, message, claim_id };
}
