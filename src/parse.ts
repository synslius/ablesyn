import type { AbleClaim, AbleDiagnostic, AbleDocument, AbleEvidence, AbleFrame, AbleVerdict } from "./types.ts";

type BlockName = "frame" | "affordance" | "belief" | "limit" | "evidence" | "probe" | "verdict";

interface CurrentBlock {
  name: BlockName;
  label?: string;
  line: number;
}

const EVIDENCE_KINDS = new Set(["observed", "missing", "inferred", "external"]);

export function parseAble(source: string, sourceName?: string): AbleDocument {
  const claims: AbleClaim[] = [];
  const diagnostics: AbleDiagnostic[] = [];
  let currentClaim: AbleClaim | undefined;
  let currentBlock: CurrentBlock | undefined;

  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = stripComment(lines[index]).trim();
    if (!line) {
      continue;
    }

    const tokens = tokenizeLine(line).map(unquote);
    if (tokens.length === 0) {
      continue;
    }

    if (tokens.length === 1 && tokens[0] === "}") {
      if (currentBlock) {
        currentBlock = undefined;
        continue;
      }
      if (currentClaim) {
        claims.push(currentClaim);
        currentClaim = undefined;
        continue;
      }
      diagnostics.push(diag("error", "UNMATCHED_CLOSE", "Unmatched closing brace.", lineNumber));
      continue;
    }

    if (tokens[0] === "claim") {
      if (currentClaim) {
        diagnostics.push(diag("error", "NESTED_CLAIM", "Nested claims are not supported in v0.", lineNumber));
        continue;
      }
      if (tokens.at(-1) !== "{") {
        diagnostics.push(diag("error", "CLAIM_OPEN", "Claim must open with `{`.", lineNumber));
        continue;
      }
      const id = tokens[1];
      if (!id || id === "{") {
        diagnostics.push(diag("error", "CLAIM_ID", "Claim is missing an id.", lineNumber));
        continue;
      }
      const title = tokens.length > 3 ? tokens.slice(2, -1).join(" ") : undefined;
      currentClaim = makeClaim(id, title === "{" ? undefined : title);
      continue;
    }

    if (!currentClaim) {
      diagnostics.push(diag("error", "OUTSIDE_CLAIM", `Line starts outside a claim: ${tokens[0]}.`, lineNumber));
      continue;
    }

    if ((tokens.includes("{") || tokens.includes("}")) && tokens.at(-1) !== "{") {
      diagnostics.push(
        diag(
          "error",
          "INLINE_BLOCK_UNSUPPORTED",
          "Inline blocks are not supported in v0; put block entries on separate lines.",
          lineNumber,
          currentClaim.id
        )
      );
      continue;
    }

    if (tokens.at(-1) === "{") {
      if (currentBlock) {
        diagnostics.push(diag("error", "NESTED_BLOCK", "Nested blocks are not supported in v0.", lineNumber, currentClaim.id));
        continue;
      }
      const blockName = tokens[0] as BlockName;
      if (!isBlockName(blockName)) {
        diagnostics.push(diag("error", "UNKNOWN_BLOCK", `Unknown block: ${tokens[0]}.`, lineNumber, currentClaim.id));
        continue;
      }
      if (blockName === "verdict") {
        const status = tokens[1] as AbleVerdict | undefined;
        if (!status) {
          diagnostics.push(diag("error", "VERDICT_STATUS", "Verdict block is missing PASS, FLAG, or BLOCK.", lineNumber, currentClaim.id));
          continue;
        }
        currentClaim.verdict = { status, reasons: [] };
        currentBlock = { name: "verdict", label: status, line: lineNumber };
        continue;
      }
      const label = tokens.length > 2 ? tokens[1] : undefined;
      if (blockName === "frame") {
        currentClaim.frame = currentClaim.frame ?? { id: label, effects: [] };
        if (label) {
          currentClaim.frame.id = label;
        }
      }
      currentBlock = { name: blockName, label, line: lineNumber };
      continue;
    }

    if (tokens[0] === "layer") {
      currentClaim.layer = tokens[1] as AbleClaim["layer"];
      continue;
    }

    if (tokens[0] === "verdict") {
      const status = tokens[1] as AbleVerdict | undefined;
      if (!status) {
        diagnostics.push(diag("error", "VERDICT_STATUS", "Verdict line is missing PASS, FLAG, or BLOCK.", lineNumber, currentClaim.id));
        continue;
      }
      currentClaim.verdict = { status, reasons: [] };
      continue;
    }

    if (!currentBlock) {
      diagnostics.push(diag("warning", "IGNORED_TOP_LEVEL", `Ignored top-level line: ${tokens[0]}.`, lineNumber, currentClaim.id));
      continue;
    }

    applyBlockEntry(currentClaim, currentBlock, tokens, diagnostics, lineNumber);
  }

  if (currentBlock) {
    diagnostics.push(diag("error", "UNCLOSED_BLOCK", `Unclosed block: ${currentBlock.name}.`, currentBlock.line, currentClaim?.id));
  }
  if (currentClaim) {
    diagnostics.push(diag("error", "UNCLOSED_CLAIM", `Unclosed claim: ${currentClaim.id}.`, undefined, currentClaim.id));
  }

  return {
    version: "0.1.0",
    source: sourceName,
    claims,
    diagnostics
  };
}

function applyBlockEntry(
  claim: AbleClaim,
  block: CurrentBlock,
  tokens: string[],
  diagnostics: AbleDiagnostic[],
  lineNumber: number
): void {
  const [key, ...args] = tokens;
  const value = args.join(" ");

  switch (block.name) {
    case "frame":
      applyFrameEntry(claim, key, args, value);
      break;
    case "affordance":
      if (key === "can" && value) {
        claim.affordance.push(value);
      } else {
        diagnostics.push(diag("warning", "UNKNOWN_AFFORDANCE", "Expected `can <value>` in affordance block.", lineNumber, claim.id));
      }
      break;
    case "belief":
      if (key === "confidence") {
        claim.belief.confidence = Number.parseFloat(args[0] ?? "NaN");
      } else if (key === "source" && value) {
        claim.belief.sources.push(value);
      } else if (key === "note" && value) {
        claim.belief.notes.push(value);
      } else {
        diagnostics.push(diag("warning", "UNKNOWN_BELIEF", `Unknown belief entry: ${key}.`, lineNumber, claim.id));
      }
      break;
    case "limit":
      if (key === "hard" || key === "soft" || key === "unknown" || key === "contextual") {
        claim.limit[key].push(value);
      } else {
        diagnostics.push(diag("warning", "UNKNOWN_LIMIT", `Unknown limit kind: ${key}.`, lineNumber, claim.id));
      }
      break;
    case "evidence":
      if (EVIDENCE_KINDS.has(key)) {
        claim.evidence.push({ kind: key as AbleEvidence["kind"], args });
      } else {
        diagnostics.push(diag("warning", "UNKNOWN_EVIDENCE", `Unknown evidence kind: ${key}.`, lineNumber, claim.id));
      }
      break;
    case "probe":
      if (key === "next" && value) {
        claim.probe.next.push(value);
      } else {
        diagnostics.push(diag("warning", "UNKNOWN_PROBE", "Expected `next <value>` in probe block.", lineNumber, claim.id));
      }
      break;
    case "verdict":
      if (key === "reason" && value) {
        claim.verdict?.reasons.push(value);
      } else {
        diagnostics.push(diag("warning", "UNKNOWN_VERDICT", "Expected `reason <text>` in verdict block.", lineNumber, claim.id));
      }
      break;
  }
}

function applyFrameEntry(claim: AbleClaim, key: string, args: string[], value: string): void {
  const frame: AbleFrame = claim.frame ?? { effects: [] };
  if (key === "quote") {
    frame.quote = value;
  } else if (key === "effect") {
    frame.effects.push({ kind: args[0] ?? "", level: args[1] });
  } else if (key === "not_evidence") {
    frame.not_evidence = args[0] === "true";
  }
  claim.frame = frame;
}

function makeClaim(id: string, title?: string): AbleClaim {
  return {
    type: "claim",
    id,
    title,
    affordance: [],
    belief: {
      sources: [],
      notes: []
    },
    limit: {
      hard: [],
      soft: [],
      unknown: [],
      contextual: []
    },
    evidence: [],
    probe: {
      next: []
    }
  };
}

function isBlockName(name: string): name is BlockName {
  return name === "frame" || name === "affordance" || name === "belief" || name === "limit" || name === "evidence" || name === "probe" || name === "verdict";
}

function stripComment(line: string): string {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === "#") {
      return line.slice(0, index);
    }
    if (!quoted && char === "/" && line[index + 1] === "/") {
      return line.slice(0, index);
    }
  }
  return line;
}

function tokenizeLine(line: string): string[] {
  return line.match(/"([^"\\]|\\.)*"|\{|\}|[^\s{}]+/g) ?? [];
}

function unquote(token: string): string {
  if (token.startsWith("\"") && token.endsWith("\"")) {
    return token
      .slice(1, -1)
      .replace(/\\"/g, "\"")
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
  return token;
}

function diag(
  severity: AbleDiagnostic["severity"],
  code: string,
  message: string,
  line?: number,
  claim_id?: string
): AbleDiagnostic {
  return { severity, code, message, line, claim_id };
}
