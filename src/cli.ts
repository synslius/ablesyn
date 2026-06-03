import { checkDocument } from "./check.ts";
import { parseAble } from "./parse.ts";
import { translateDocument, type TranslationTarget } from "./translate.ts";
import { readFile, readdir } from "node:fs/promises";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  printUsage();
  process.exit(command ? 0 : 1);
}

if (command === "version") {
  console.log("ablesyn 0.1.1");
  process.exit(0);
}

if (command === "demo") {
  // Zero-config showcase: run the .able files that ship inside the package
  // through the same parse + check path the `check` command uses, so a stranger
  // can `npx ablesyn demo` and watch the verdicts land with no input.
  const examplesDir = new URL("../examples/", import.meta.url);
  let names: string[];
  try {
    names = (await readdir(examplesDir)).filter((name) => name.endsWith(".able")).sort();
  } catch {
    console.error("demo: bundled examples/ not found alongside the ablesyn install.");
    process.exit(1);
  }
  if (names.length === 0) {
    console.error("demo: no bundled .able examples were found.");
    process.exit(1);
  }
  console.log("ablesyn demo — bundled .able claims run through the checker\n");
  for (const name of names) {
    const source = await readFile(new URL(name, examplesDir), "utf8");
    const document = parseAble(source, `examples/${name}`);
    const result = checkDocument(document);
    const verdicts = document.claims.map((claim) => claim.verdict?.status ?? "UNKNOWN").join(", ");
    const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
    const counts = [
      errors ? `${errors} error${errors === 1 ? "" : "s"}` : "",
      warnings ? `${warnings} warning${warnings === 1 ? "" : "s"}` : ""
    ].filter(Boolean).join(", ");
    console.log(`  [${result.ok ? "ok  " : "FAIL"}] examples/${name}`);
    console.log(`         declared ${verdicts}${counts ? `  (check: ${counts})` : "  (check: clean)"}`);
  }
  console.log(`\n${names.length} example(s). Full contract: \`ablesyn check <file.able>\` or \`ablesyn translate <file.able> --to en\`.`);
  process.exit(0);
}

const files = positionalFiles(args.slice(1));
const json = args.includes("--json");
const rawTo = readOption(args, "--to");
const to = rawTo ?? "en";

if (command === "translate" && args.includes("--to") && (!rawTo || rawTo.startsWith("--") || (rawTo !== "en" && rawTo !== "zh"))) {
  console.error("Invalid --to target. Expected `en` or `zh`.");
  process.exit(1);
}

if (files.length === 0) {
  console.error("No .able files provided.");
  printUsage();
  process.exit(1);
}

let hadError = false;

for (const file of files) {
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`${file}: ERROR CANNOT_READ: ${message}`);
    hadError = true;
    continue;
  }
  const document = parseAble(source, file);

  if (command === "parse") {
    if (json) {
      console.log(JSON.stringify(document, null, 2));
    } else {
      console.log(translateDocument(document, "en"));
    }
    continue;
  }

  if (command === "check") {
    const result = checkDocument(document);
    for (const diagnostic of result.diagnostics) {
      const location = diagnostic.line ? `${file}:${diagnostic.line}` : file;
      const claim = diagnostic.claim_id ? ` ${diagnostic.claim_id}` : "";
      console.log(`${location}:${claim} ${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`);
    }
    console.log(`${file}: ${result.ok ? "OK" : "FAIL"}`);
    hadError ||= !result.ok;
    continue;
  }

  if (command === "translate") {
    if (to !== "en" && to !== "zh") {
      console.error(`Unsupported translation target: ${to}`);
      process.exit(1);
    }
    console.log(translateDocument(document, to as TranslationTarget));
    continue;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

process.exit(hadError ? 1 : 0);

function readOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function positionalFiles(argv: string[]): string[] {
  const files: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      continue;
    }
    if (arg === "--to") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      continue;
    }
    files.push(arg);
  }
  return files;
}

function printUsage(): void {
  console.log(`ablesyn v0

Usage:
  bun run ablesyn parse <file.able> [--json]
  bun run ablesyn check <file.able> [...]
  bun run ablesyn translate <file.able> --to en|zh
  ablesyn demo                              run the bundled example claims (no args)
`);
}
