import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  adjudicate,
  claimToDocument,
  DOWNGRADE_CODES,
  type RawClaim
} from "../src/adjudicate.ts";
import { CHECK_ERROR_CODES, checkDocument } from "../src/check.ts";

// --- adjudicate downgrade policy -------------------------------------------

test("inferred-only PASS downgrades to FLAG", () => {
  const claim: RawClaim = {
    id: "inferred_only",
    layer: "BEHAVIOR",
    evidence: [{ kind: "inferred", args: ["i_reasoned_about_it"] }],
    verdict: { status: "PASS" }
  };
  const result = adjudicate(claim);
  expect(result.verdict_claimed).toBe("PASS");
  expect(result.verdict_adjudicated).toBe("FLAG");
  expect(result.hard_structural).toBe(false);
  expect(result.rules_fired.map((r) => r.code)).toContain("PASS_WITHOUT_OBSERVED_EVIDENCE");
});

test("empty-evidence PASS downgrades to FLAG (soft, not BLOCK)", () => {
  const claim: RawClaim = {
    id: "empty_evidence",
    layer: "BEHAVIOR",
    evidence: [],
    verdict: { status: "PASS" }
  };
  const result = adjudicate(claim);
  expect(result.verdict_claimed).toBe("PASS");
  expect(result.verdict_adjudicated).toBe("FLAG");
  expect(result.hard_structural).toBe(false);
  // The well-formed-but-incomplete error fired, and it is a downgrade code.
  expect(result.rules_fired.map((r) => r.code)).toContain("PASS_WITHOUT_EVIDENCE");
  expect(DOWNGRADE_CODES).toContain("PASS_WITHOUT_EVIDENCE");
  // `ok` still honestly reflects the checker error so it can never be authoritative.
  expect(result.ok).toBe(false);
});

test("INVALID_LAYER PASS is hard_structural and BLOCKs", () => {
  const claim: RawClaim = {
    id: "bad_layer",
    layer: "NOT_A_LAYER",
    evidence: [{ kind: "observed", args: ["real_thing"] }],
    verdict: { status: "PASS" }
  };
  const result = adjudicate(claim);
  expect(result.verdict_adjudicated).toBe("BLOCK");
  expect(result.hard_structural).toBe(true);
  expect(result.rules_fired.map((r) => r.code)).toContain("INVALID_LAYER");
});

test("INVALID_CONFIDENCE PASS is hard_structural and BLOCKs", () => {
  const claim: RawClaim = {
    id: "bad_confidence",
    layer: "BEHAVIOR",
    belief: { confidence: 7 },
    evidence: [{ kind: "observed", args: ["real_thing"] }],
    verdict: { status: "PASS" }
  };
  const result = adjudicate(claim);
  expect(result.verdict_adjudicated).toBe("BLOCK");
  expect(result.hard_structural).toBe(true);
  expect(result.rules_fired.map((r) => r.code)).toContain("INVALID_CONFIDENCE");
});

test("clean observed PASS is surfaced as PASS_UNVERIFIED (not PASS)", () => {
  const claim: RawClaim = {
    id: "clean_observed",
    layer: "BEHAVIOR",
    evidence: [{ kind: "observed", args: ["dist/cli.js"] }],
    verdict: { status: "PASS" }
  };
  const result = adjudicate(claim);
  expect(result.verdict_claimed).toBe("PASS");
  expect(result.verdict_adjudicated).toBe("PASS_UNVERIFIED");
  expect(result.verdict_adjudicated).not.toBe("PASS");
  expect(result.hard_structural).toBe(false);
  expect(result.ok).toBe(true);
});

test("FLAG with an open probe stays FLAG and is never upgraded", () => {
  const claim: RawClaim = {
    id: "flag_with_probe",
    layer: "BEHAVIOR",
    evidence: [{ kind: "observed", args: ["partial"] }],
    probe: { next: ["check the remaining edge case"] },
    verdict: { status: "FLAG" }
  };
  const result = adjudicate(claim);
  expect(result.verdict_claimed).toBe("FLAG");
  expect(result.verdict_adjudicated).toBe("FLAG");
});

test("claimed BLOCK passes through to BLOCK", () => {
  const claim: RawClaim = {
    id: "claimed_block",
    layer: "BEHAVIOR",
    evidence: [{ kind: "observed", args: ["x"] }],
    verdict: { status: "BLOCK" }
  };
  const result = adjudicate(claim);
  expect(result.verdict_claimed).toBe("BLOCK");
  expect(result.verdict_adjudicated).toBe("BLOCK");
});

// --- claimToDocument totality (no-throw) ------------------------------------

test("claimToDocument normalizes a minimal {id,layer,evidence,verdict} claim without throwing", () => {
  const minimal: RawClaim = {
    id: "minimal",
    layer: "BEHAVIOR",
    evidence: [{ kind: "observed", args: ["x"] }],
    verdict: { status: "PASS" }
  };
  let doc;
  expect(() => {
    doc = claimToDocument(minimal);
  }).not.toThrow();
  // All five fields the checker dereferences must be present (no-throw pin).
  const claim = doc!.claims[0];
  expect(Array.isArray(claim.belief.sources)).toBe(true);
  expect(Array.isArray(claim.limit.unknown)).toBe(true);
  expect(Array.isArray(claim.evidence)).toBe(true);
  expect(Array.isArray(claim.probe.next)).toBe(true);
  expect(claim.verdict).toBeDefined();
  // The normalized doc feeds checkDocument without throwing.
  expect(() => checkDocument(doc!)).not.toThrow();
});

test("claimToDocument backfills an absolutely minimal {id} claim without throwing", () => {
  let doc;
  expect(() => {
    doc = claimToDocument({ id: "bare" });
  }).not.toThrow();
  expect(() => checkDocument(doc!)).not.toThrow();
  const claim = doc!.claims[0];
  expect(claim.id).toBe("bare");
  expect(claim.belief.sources).toEqual([]);
  expect(claim.limit.hard).toEqual([]);
  expect(claim.evidence).toEqual([]);
  expect(claim.probe.next).toEqual([]);
});

test("adjudicate never throws on the minimal claim and maps a checker crash to BLOCK", () => {
  // A crafted input designed to crash the checker: `evidence` is present but a
  // member lacks `args` as an array AND has a poisoned getter that throws when
  // the checker reads it. claimToDocument normalizes args to [], so to force a
  // throw we poison the normalized claim path via a getter on the object the
  // checker reaches. Simplest deterministic crash: a frame.effects entry whose
  // `kind` getter throws — checkDocument calls `effect.kind` in `.some(...)`.
  const crashing: RawClaim = {
    id: "crash",
    layer: "BEHAVIOR",
    evidence: [{ kind: "observed", args: ["x"] }],
    verdict: { status: "PASS" },
    frame: {
      effects: [
        // A getter that throws when the checker dereferences `.kind`.
        Object.defineProperty({}, "kind", {
          enumerable: true,
          get() {
            throw new Error("boom");
          }
        }) as unknown as { kind: string }
      ] as unknown as never
    }
  };
  let result;
  expect(() => {
    result = adjudicate(crashing);
  }).not.toThrow();
  expect(result!.verdict_adjudicated).toBe("BLOCK");
  expect(result!.hard_structural).toBe(true);
  expect(result!.rules_fired.map((r) => r.code)).toContain("ADJUDICATE_THREW");
});

// --- DOWNGRADE_CODES composition --------------------------------------------

test("DOWNGRADE_CODES = CHECK_ERROR_CODES union the two extra SLI codes", () => {
  for (const code of CHECK_ERROR_CODES) {
    expect(DOWNGRADE_CODES).toContain(code);
  }
  expect(DOWNGRADE_CODES).toContain("PASS_WITHOUT_OBSERVED_EVIDENCE");
  expect(DOWNGRADE_CODES).toContain("PASS_WITH_OPEN_PROBE");
  expect(DOWNGRADE_CODES.length).toBe(CHECK_ERROR_CODES.length + 2);
});

// --- grep-guard: CHECK_ERROR_CODES covers every error(...) literal -----------

test("CHECK_ERROR_CODES covers every error(...) code literal in check.ts and length === 11", () => {
  const source = readFileSync(new URL("../src/check.ts", import.meta.url), "utf8");

  // Strip the registry array itself so its literals don't pollute the scan; we
  // only want the codes that appear in actual `error(...)` call sites.
  const withoutRegistry = source.replace(
    /export const CHECK_ERROR_CODES[\s\S]*?\]\s*as const;/,
    ""
  );

  // Tokenize `error(` calls, allowing the code literal on the same or next
  // line(s). Match `error(` then the first quoted string that follows.
  const errorCallCodes = new Set<string>();
  const regex = /error\(\s*"([A-Z0-9_]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(withoutRegistry)) !== null) {
    errorCallCodes.add(match[1]);
  }

  // The two multi-line error() calls put the code on the next line; the regex
  // above already tolerates whitespace, so this catches them too.
  expect(errorCallCodes.size).toBe(11);
  expect(CHECK_ERROR_CODES.length).toBe(11);

  // Every code emitted by an error(...) site is in the registry, and vice versa.
  for (const code of errorCallCodes) {
    expect(CHECK_ERROR_CODES).toContain(code);
  }
  for (const code of CHECK_ERROR_CODES) {
    expect(errorCallCodes.has(code)).toBe(true);
  }
});
