#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

mustPass("tests", ["bun", "test", "tests/parse.test.ts", "tests/cli.test.ts", "tests/translate.test.ts"]);
mustPass("examples", [
  "bun",
  "run",
  "src/cli.ts",
  "check",
  "examples/hello.able",
  "examples/capability-claim.able",
  "examples/self-verification.able"
]);

mustFail("pass-without-evidence", ["bun", "run", "src/cli.ts", "check", "tests/fixtures/pass-without-evidence.able"], [
  "PASS_WITHOUT_EVIDENCE"
]);
mustFail("self-report-only", ["bun", "run", "src/cli.ts", "check", "tests/fixtures/pass-self-report-nonsubstrate.able"], [
  "SELF_REPORT_IS_NOT_AUTHORITY"
]);
mustFail("motivation-truth-confidence", [
  "bun",
  "run",
  "src/cli.ts",
  "check",
  "tests/fixtures/motivation-raises-truth-confidence.able"
], ["MOTIVATION_RAISES_TRUTH_CONFIDENCE"]);
mustFail("inline-block", ["bun", "run", "src/cli.ts", "check", "tests/fixtures/inline-block-unsupported.able"], [
  "INLINE_BLOCK_UNSUPPORTED"
]);

mustTranslate("translate-en", "en");
mustTranslate("translate-zh", "zh");
scanPublicSurface();

if (failures.length > 0) {
  console.log("ABLESYN_VERIFY");
  console.log("VERDICT: BLOCK");
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  process.exit(1);
}

console.log("ABLESYN_VERIFY");
console.log("VERDICT: PASS");
console.log("TESTS: PASS");
console.log("NEGATIVE_FIXTURES: PASS");
console.log("TRANSLATION: PASS");
console.log("PUBLIC_SAFETY: PASS");

function mustPass(name, command) {
  const result = run(command);
  if (result.status !== 0) {
    failures.push(`${name}: expected pass, got ${result.status}: ${oneLine(result.output)}`);
  }
}

function mustFail(name, command, requiredSnippets) {
  const result = run(command);
  if (result.status === 0) {
    failures.push(`${name}: expected non-zero exit`);
  }
  for (const snippet of requiredSnippets) {
    if (!result.output.includes(snippet)) {
      failures.push(`${name}: missing diagnostic ${snippet}`);
    }
  }
}

function mustTranslate(name, target) {
  const result = run([
    "bun",
    "run",
    "src/cli.ts",
    "translate",
    "tests/fixtures/translation-frame-effects-contextual.able",
    "--to",
    target
  ]);
  if (result.status !== 0) {
    failures.push(`${name}: translate exited ${result.status}`);
    return;
  }
  for (const snippet of [
    "effects raise_exploration_budget:moderate",
    "not_evidence true",
    "contextual local_repo_state_only",
    "missing regression_test"
  ]) {
    if (!result.output.includes(snippet)) {
      failures.push(`${name}: missing ${snippet}`);
    }
  }
}

function scanPublicSurface() {
  const tokenPrefixes = ["s" + "k", "s" + "k-proj", "s" + "k-ant", "ghp", "github_pat", "xoxb", "xoxp", "hf"];
  const forbidden = [
    { name: "local path", pattern: /\/Users\/0xvox\b/ },
    { name: "token shape", pattern: new RegExp(`\\b(?:${tokenPrefixes.join("|")})[-_][A-Za-z0-9_-]{16,}\\b`, "i") },
    { name: "private ipv4", pattern: /\b(?:127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})\b/ }
  ];
  for (const file of listTextFiles(root)) {
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(text)) {
        failures.push(`${rel}: forbidden ${rule.name}`);
      }
    }
  }
}

function run(command) {
  const [cmd, ...args] = command;
  const result = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`
  };
}

function oneLine(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

function listTextFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTextFiles(full));
    } else if (/\.(ts|mjs|md|json|able)$/.test(entry.name) || ["LICENSE", "NOTICE"].includes(entry.name)) {
      out.push(full);
    }
  }
  return out;
}
