import { expect, test } from "bun:test";
import { checkDocument } from "../src/check.ts";
import { parseAble } from "../src/parse.ts";

test("parses the capability framing example without check errors", async () => {
  const source = await Bun.file("examples/capability-claim.able").text();
  const document = parseAble(source, "examples/capability-claim.able");
  const claim = document.claims[0];

  expect(claim.id).toBe("capability_framing");
  expect(claim.layer).toBe("BEHAVIOR");
  expect(claim.frame?.not_evidence).toBe(true);
  expect(claim.belief.confidence).toBe(0.58);
  expect(claim.verdict?.status).toBe("FLAG");
  expect(checkDocument(document).ok).toBe(true);
});

test("keeps self-reported runtime identity blocked without substrate proof", async () => {
  const source = await Bun.file("examples/self-verification.able").text();
  const document = parseAble(source, "examples/self-verification.able");
  const claim = document.claims[0];

  expect(claim.layer).toBe("NARRATIVE");
  expect(claim.evidence.some((entry) => entry.kind === "missing" && entry.args.includes("substrate_probe"))).toBe(true);
  expect(claim.verdict?.status).toBe("BLOCK");
  expect(checkDocument(document).ok).toBe(true);
});

test("rejects substrate PASS authorized only by self-report", async () => {
  const source = await Bun.file("tests/fixtures/pass-with-self-report.able").text();
  const document = parseAble(source, "tests/fixtures/pass-with-self-report.able");
  const result = checkDocument(document);

  expect(result.ok).toBe(false);
  expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SELF_REPORT_IS_NOT_AUTHORITY")).toBe(true);
});

test("rejects a non-substrate PASS authorized only by self-report", async () => {
  const source = await Bun.file("tests/fixtures/pass-self-report-nonsubstrate.able").text();
  const document = parseAble(source, "tests/fixtures/pass-self-report-nonsubstrate.able");
  const result = checkDocument(document);

  expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SELF_REPORT_IS_NOT_AUTHORITY")).toBe(true);
  expect(result.ok).toBe(false);
});

test("rejects a PASS authorized by an aliased self-report token", async () => {
  const source = await Bun.file("tests/fixtures/pass-self-report-aliased.able").text();
  const document = parseAble(source, "tests/fixtures/pass-self-report-aliased.able");
  const result = checkDocument(document);

  expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SELF_REPORT_IS_NOT_AUTHORITY")).toBe(true);
  expect(result.ok).toBe(false);
});

test("allows a PASS when self-report is corroborated by external evidence", async () => {
  const source = await Bun.file("tests/fixtures/pass-self-report-with-external.able").text();
  const document = parseAble(source, "tests/fixtures/pass-self-report-with-external.able");
  const result = checkDocument(document);

  expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SELF_REPORT_IS_NOT_AUTHORITY")).toBe(false);
  expect(result.ok).toBe(true);
});

test("blocks a PASS that has no supporting evidence", async () => {
  const source = await Bun.file("tests/fixtures/pass-without-evidence.able").text();
  const document = parseAble(source, "tests/fixtures/pass-without-evidence.able");
  const result = checkDocument(document);

  expect(result.diagnostics.some((diagnostic) => diagnostic.code === "PASS_WITHOUT_EVIDENCE")).toBe(true);
  expect(result.ok).toBe(false);
});
