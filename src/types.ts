export type AbleLayer = "NARRATIVE" | "BEHAVIOR" | "SUBSTRATE" | "EVIDENCE";
export type AbleVerdict = "PASS" | "FLAG" | "BLOCK";
export type DiagnosticSeverity = "error" | "warning";

export interface AbleDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  line?: number;
  claim_id?: string;
}

export interface AbleFrame {
  id?: string;
  quote?: string;
  effects: Array<{
    kind: string;
    level?: string;
  }>;
  not_evidence?: boolean;
}

export interface AbleEvidence {
  kind: "observed" | "missing" | "inferred" | "external";
  args: string[];
}

export interface AbleClaim {
  type: "claim";
  id: string;
  title?: string;
  layer?: AbleLayer;
  frame?: AbleFrame;
  affordance: string[];
  belief: {
    confidence?: number;
    sources: string[];
    notes: string[];
  };
  limit: {
    hard: string[];
    soft: string[];
    unknown: string[];
    contextual: string[];
  };
  evidence: AbleEvidence[];
  probe: {
    next: string[];
  };
  verdict?: {
    status: AbleVerdict;
    reasons: string[];
  };
}

export interface AbleDocument {
  version: "0.1.0";
  source?: string;
  claims: AbleClaim[];
  diagnostics: AbleDiagnostic[];
}

