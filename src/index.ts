// ablesyn library surface. This entry is import-clean (no shebang — the shebang
// is scoped to the cli entry in tsup.config.ts). Consumers `import { ... } from
// "ablesyn"` get the parser, the checker, the structural adjudicator, the shared
// default-claim builder, the error-code registry, and the types.

export { parseAble } from "./parse.ts";
export { defaultClaim } from "./parse.ts";
export {
  checkDocument,
  CHECK_ERROR_CODES,
  type CheckErrorCode,
  type CheckResult
} from "./check.ts";
export {
  adjudicate,
  claimToDocument,
  DOWNGRADE_CODES,
  type Adjudication,
  type RawClaim
} from "./adjudicate.ts";
export { translateDocument, type TranslationTarget } from "./translate.ts";

export type {
  AbleClaim,
  AbleDocument,
  AbleDiagnostic,
  AbleEvidence,
  AbleFrame,
  AbleLayer,
  AbleVerdict,
  DiagnosticSeverity
} from "./types.ts";
