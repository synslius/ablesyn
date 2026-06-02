import { checkDocument } from "./check.ts";
import { parseAble } from "./parse.ts";
import { translateDocument, type TranslationTarget } from "./translate.ts";
import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  printUsage();
  process.exit(command ? 0 : 1);
}

if (command === "version") {
  console.log("ablesyn 0.1.0");
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
`);
}
