import { CHECK_ERROR_CODES, checkDocument, type CheckResult } from "./check.ts";
import { defaultClaim } from "./parse.ts";
import type {
  AbleClaim,
  AbleDiagnostic,
  AbleDocument,
  AbleEvidence,
  AbleFrame,
  AbleLayer,
  AbleVerdict
} from "./types.ts";

/**
 * The SLI downgrade policy is STRICTER than ablesyn severity: a structurally
 * clean PASS is only `PASS_UNVERIFIED` here (the semantic tier promotes it
 * later — not in this wave), and two ablesyn *warnings* are treated as
 * downgrade triggers because the SLI never lets a structurally-incomplete PASS
 * survive as a finished PASS.
 *
 * DOWNGRADE_CODES = CHECK_ERROR_CODES ∪ {PASS_WITHOUT_OBSERVED_EVIDENCE,
 * PASS_WITH_OPEN_PROBE}. (`PASS_WITHOUT_OBSERVED_EVIDENCE` fires when a PASS has
 * only inferred evidence; `PASS_WITH_OPEN_PROBE` is the round-3 P3 addition —
 * ablesyn maps it to a warning/FLAG, so a STRICTER-than-ablesyn policy must
 * include it.)
 */
export const DOWNGRADE_CODES: readonly string[] = [
  ...CHECK_ERROR_CODES,
  "PASS_WITHOUT_OBSERVED_EVIDENCE",
  "PASS_WITH_OPEN_PROBE"
];

const DOWNGRADE_SET = new Set<string>(DOWNGRADE_CODES);

/**
 * The malformed-SHAPE error codes — the subset of CHECK_ERROR_CODES that means
 * the claim does not conform to the ABLE schema (bad id / layer / verdict /
 * confidence / no claims at all), as opposed to content-completeness errors
 * (`PASS_WITHOUT_EVIDENCE`, `PASS_WITH_MISSING_EVIDENCE`,
 * `SELF_REPORT_IS_NOT_AUTHORITY`, `MOTIVATION_RAISES_TRUTH_CONFIDENCE`).
 *
 * This is the discriminator behind `hard_structural` and the spec's hard-vs-soft
 * split (§4.1 rules 2–3): a *malformed* claim → BLOCK/quarantine and may NOT
 * reach the verified-finding queue, while a *well-formed but incomplete* PASS
 * (empty/inferred-only evidence) is a soft FLAG that stays eligible. Proof A
 * (§5) requires the four planted cheats — including the empty-evidence one — to
 * downgrade to FLAG, while §4.1 rule 2 requires INVALID_LAYER/INVALID_CONFIDENCE
 * to BLOCK; only a shape-vs-content split satisfies both. `ok` still projects
 * the true `CheckResult.ok` (so an empty-evidence PASS is `ok:false`, never
 * authoritative) — `hard_structural` is the stricter "malformed" signal.
 */
const HARD_STRUCTURAL_CODES = new Set<string>([
  "NO_CLAIMS",
  "INVALID_CLAIM_ID",
  "MISSING_LAYER",
  "INVALID_LAYER",
  "MISSING_VERDICT",
  "INVALID_VERDICT",
  "INVALID_CONFIDENCE"
]);

/**
 * A raw worker claim: a partial ABLE claim as emitted by an LLM worker. This is
 * deliberately a SEPARATE type from {@link AbleClaim} — every field is optional
 * and the nested shapes are loose, because worker JSON is untrusted input.
 * {@link claimToDocument} is the total normalizer that backfills it into a valid
 * AbleClaim/AbleDocument the checker can consume without throwing.
 */
export interface RawClaim {
  id?: unknown;
  title?: unknown;
  layer?: unknown;
  assertion?: unknown;
  affordance?: unknown;
  belief?: {
    confidence?: unknown;
    sources?: unknown;
    notes?: unknown;
  } | null;
  limit?: {
    hard?: unknown;
    soft?: unknown;
    unknown?: unknown;
    contextual?: unknown;
  } | null;
  evidence?: unknown;
  probe?: { next?: unknown } | null;
  frame?: {
    id?: unknown;
    quote?: unknown;
    effects?: unknown;
    not_evidence?: unknown;
  } | null;
  verdict?: { status?: unknown; reasons?: unknown } | null;
}

export interface Adjudication {
  claim_id: string;
  verdict_claimed: "PASS" | "FLAG" | "BLOCK";
  verdict_adjudicated: "PASS" | "PASS_UNVERIFIED" | "FLAG" | "BLOCK";
  rules_fired: { code: string; severity: "error" | "warning"; message: string }[];
  /** ablesyn CheckResult.ok — projected into the receipt (round-3 fix). */
  ok: boolean;
  /** true if any error-severity rule fired (ok === false). */
  hard_structural: boolean;
}

const EVIDENCE_KINDS = new Set(["observed", "missing", "inferred", "external"]);

function toStringArray(value: unknown): string[] {
  // A SCALAR string is a single-element array, not empty: a worker that emits
  // `args: "self_report"` (scalar) must NOT have the token silently dropped, or
  // a self-report PASS escapes the SELF_REPORT_IS_NOT_AUTHORITY downgrade. Same
  // for scalar belief.sources / limit.unknown.
  if (typeof value === "string") {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeEvidence(value: unknown): AbleEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: AbleEvidence[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as { kind?: unknown; args?: unknown };
    // Preserve the raw kind even if unrecognized — the checker only branches on
    // known kinds, and a normalizer must not throw on a bad kind. We keep the
    // string so downstream code can see exactly what the worker emitted.
    const kind = typeof record.kind === "string" ? record.kind : "inferred";
    out.push({
      kind: (EVIDENCE_KINDS.has(kind) ? kind : kind) as AbleEvidence["kind"],
      args: toStringArray(record.args)
    });
  }
  return out;
}

function normalizeFrame(value: RawClaim["frame"]): AbleFrame | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const effects: AbleFrame["effects"] = [];
  if (Array.isArray(value.effects)) {
    for (const effect of value.effects) {
      if (!effect || typeof effect !== "object") {
        continue;
      }
      const record = effect as { kind?: unknown; level?: unknown };
      effects.push({
        kind: typeof record.kind === "string" ? record.kind : "",
        level: typeof record.level === "string" ? record.level : undefined
      });
    }
  }
  const frame: AbleFrame = { effects };
  if (typeof value.id === "string") {
    frame.id = value.id;
  }
  if (typeof value.quote === "string") {
    frame.quote = value.quote;
  }
  if (typeof value.not_evidence === "boolean") {
    frame.not_evidence = value.not_evidence;
  }
  return frame;
}

function normalizeVerdict(value: RawClaim["verdict"]): AbleClaim["verdict"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  // Keep the raw status string even if it is not a valid verdict — the checker
  // emits INVALID_VERDICT for that, which is exactly the hard-structural signal
  // we want to surface rather than swallow.
  const status = (typeof value.status === "string" ? value.status : undefined) as AbleVerdict | undefined;
  if (status === undefined) {
    return undefined;
  }
  return { status, reasons: toStringArray(value.reasons) };
}

/**
 * TOTAL normalizer: takes raw worker JSON (a partial {@link RawClaim}) and
 * backfills every nested field via {@link defaultClaim}'s defaults, returning a
 * valid {@link AbleDocument} that {@link checkDocument} can consume WITHOUT
 * throwing.
 *
 * A minimal `{ id, layer, evidence, verdict }`-only input normalizes and never
 * throws: missing nested arrays/objects fall back to the shared defaults, so the
 * five fields the checker dereferences (`belief.sources`, `limit.unknown`,
 * `evidence`, `probe.next`, `verdict`) are always present.
 */
export function claimToDocument(claim: RawClaim): AbleDocument {
  const raw: RawClaim = claim && typeof claim === "object" ? claim : {};
  const id = typeof raw.id === "string" ? raw.id : "";
  const title = typeof raw.title === "string" ? raw.title : undefined;

  // Start from the single source of truth for all nested defaults.
  const normalized: AbleClaim = defaultClaim(id, title);

  if (typeof raw.layer === "string") {
    normalized.layer = raw.layer as AbleLayer;
  }

  normalized.affordance = toStringArray(raw.affordance);

  if (raw.belief && typeof raw.belief === "object") {
    // Do NOT drop a present-but-non-number confidence (e.g. "high", "0.8"):
    // pass it THROUGH so the checker's Number.isFinite test fires
    // INVALID_CONFIDENCE → BLOCK rather than silently swallowing the malformed
    // value. The cast lets the malformed value reach the checker unchanged.
    if (raw.belief.confidence !== undefined) {
      normalized.belief.confidence = raw.belief.confidence as AbleClaim["belief"]["confidence"];
    }
    normalized.belief.sources = toStringArray(raw.belief.sources);
    normalized.belief.notes = toStringArray(raw.belief.notes);
  }

  if (raw.limit && typeof raw.limit === "object") {
    normalized.limit.hard = toStringArray(raw.limit.hard);
    normalized.limit.soft = toStringArray(raw.limit.soft);
    normalized.limit.unknown = toStringArray(raw.limit.unknown);
    normalized.limit.contextual = toStringArray(raw.limit.contextual);
  }

  normalized.evidence = normalizeEvidence(raw.evidence);

  if (raw.probe && typeof raw.probe === "object") {
    normalized.probe.next = toStringArray(raw.probe.next);
  }

  const frame = normalizeFrame(raw.frame);
  if (frame) {
    normalized.frame = frame;
  }

  const verdict = normalizeVerdict(raw.verdict);
  if (verdict) {
    normalized.verdict = verdict;
  }

  return {
    version: "0.1.0",
    claims: [normalized],
    diagnostics: []
  };
}

function projectResult(result: CheckResult, claimId: string): {
  rules_fired: Adjudication["rules_fired"];
  ok: boolean;
  hard_structural: boolean;
  firedCodes: Set<string>;
} {
  const relevant: AbleDiagnostic[] = result.diagnostics.filter(
    (diagnostic) => diagnostic.claim_id === undefined || diagnostic.claim_id === claimId
  );
  const rules_fired = relevant.map((diagnostic) => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message
  }));
  const firedCodes = new Set(relevant.map((diagnostic) => diagnostic.code));
  // `hard_structural` is the stricter MALFORMED-shape signal (§4.1 rules 2-3),
  // not a raw `ok===false`: a well-formed-but-incomplete PASS (empty/inferred
  // evidence) is a soft FLAG, while a bad id/layer/verdict/confidence is a hard
  // BLOCK. `ok` still carries the true checker verdict.
  const hard_structural = [...firedCodes].some((code) => HARD_STRUCTURAL_CODES.has(code));
  return {
    rules_fired,
    ok: result.ok,
    hard_structural,
    firedCodes
  };
}

function claimedVerdict(claim: RawClaim): "PASS" | "FLAG" | "BLOCK" | undefined {
  const status = claim?.verdict?.status;
  if (status === "PASS" || status === "FLAG" || status === "BLOCK") {
    return status;
  }
  return undefined;
}

/**
 * STRUCTURAL adjudication only (no semantic tier / no ProofWheel in this wave).
 *
 * Runs `claimToDocument(claim)` → `checkDocument(doc)` → applies the SLI
 * downgrade policy:
 *
 *  - claimed PASS + any DOWNGRADE_CODES fired → FLAG
 *  - hard_structural (ok === false, e.g. INVALID_LAYER/INVALID_CONFIDENCE) → BLOCK
 *  - claimed PASS that is structurally clean → PASS_UNVERIFIED (NOT "PASS" — the
 *    semantic tier promotes it later)
 *  - claimed FLAG/BLOCK pass through, never upgraded
 *
 * Fail-closed: if the checker itself throws (a crafted crash input), the claim
 * maps to BLOCK with an ADJUDICATE_THREW rule rather than propagating.
 */
export function adjudicate(claim: RawClaim): Adjudication {
  // The id/verdict reads live INSIDE the try: a poisoned THROWING getter on
  // `claim.id` or `claim.verdict.status` must degrade to a fail-closed BLOCK
  // receipt, never escape the catch. The catch defaults them so a throwing
  // getter still yields a well-formed ADJUDICATE_THREW/BLOCK.
  let claim_id = "";
  let verdict_claimed: "PASS" | "FLAG" | "BLOCK" | undefined;

  let projected: ReturnType<typeof projectResult>;
  try {
    claim_id =
      claim && typeof claim === "object" && typeof claim.id === "string" ? claim.id : "";
    verdict_claimed = claimedVerdict(claim);

    const document = claimToDocument(claim);
    const result = checkDocument(document);
    projected = projectResult(result, claim_id);
  } catch (cause) {
    // Fail-closed (CODE): a checker crash — or a throwing getter on id/verdict —
    // becomes a BLOCK, never a throw. claim_id falls back to "" and
    // verdict_claimed to undefined if the read itself threw.
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      claim_id,
      verdict_claimed: verdict_claimed ?? "BLOCK",
      verdict_adjudicated: "BLOCK",
      rules_fired: [
        {
          code: "ADJUDICATE_THREW",
          severity: "error",
          message: `adjudicate threw while checking the claim: ${message}`
        }
      ],
      ok: false,
      hard_structural: true
    };
  }

  const { rules_fired, ok, hard_structural, firedCodes } = projected;

  let verdict_adjudicated: Adjudication["verdict_adjudicated"];

  if (hard_structural) {
    // Hard-structural (ok === false) → BLOCK/quarantine, never a soft FLAG.
    verdict_adjudicated = "BLOCK";
  } else if (verdict_claimed === "PASS") {
    const downgraded = [...firedCodes].some((code) => DOWNGRADE_SET.has(code));
    // Structurally clean PASS is surfaced as PASS_UNVERIFIED (fail-closed: the
    // naive `=== "PASS"` filter never lets a structural-only PASS survive). Any
    // downgrade code knocks it to FLAG.
    verdict_adjudicated = downgraded ? "FLAG" : "PASS_UNVERIFIED";
  } else if (verdict_claimed === "FLAG") {
    verdict_adjudicated = "FLAG";
  } else {
    // claimed BLOCK, or no/invalid claimed verdict → BLOCK. (An invalid verdict
    // status is hard-structural above; this is the claimed-BLOCK / missing case.)
    verdict_adjudicated = "BLOCK";
  }

  return {
    claim_id,
    verdict_claimed: verdict_claimed ?? "BLOCK",
    verdict_adjudicated,
    rules_fired,
    ok,
    hard_structural
  };
}
