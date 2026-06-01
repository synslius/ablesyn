# ablesyn v0 Spec

This spec defines the first, deliberately small shape of `.able` files. It is a contract for evidence-aware claims, not a full programming language.

## Semantic Model

An ablesyn claim describes a capability statement at a named layer. Each claim should answer:

- What can be attempted now?
- What belief or confidence is held?
- What limits still bind the claim?
- What evidence exists or is missing?
- What probe would reduce uncertainty?
- What verdict should a human or agent carry forward?

The central invariant is:

> Motivation may change exploration budget, not truth confidence.

Self-report may be recorded as evidence, but it cannot by itself authorize a substrate or truth claim.

Motivational or identity framing may raise exploration budget only when it is
kept separate from evidence. A frame effect such as
`raise_exploration_budget` should be marked `not_evidence true` unless separate
evidence supports the claim. Effects that attempt to raise truth confidence,
such as `raise_truth_confidence`, `boost_confidence`, or `authorize_pass`, are
checker errors even when marked `not_evidence true`.

## Layers

`NARRATIVE`: What the agent says, frames, believes, or reports.

`BEHAVIOR`: What the agent actually does or changes in action, planning, tool use, or prioritization.

`SUBSTRATE`: Runtime facts such as model identity, tool availability, system state, permissions, scheduler state, or hidden machinery.

`EVIDENCE`: External or inspectable proof such as files, tests, logs, traces, probes, records, or references.

Every capability claim should name exactly one primary `layer`. Cross-layer implications should be modeled as evidence or probes, not silently merged.

## Verdict Model

`PASS`: Evidence supports the claim at the named layer. Missing critical proof, open probes, or known contradictions should prevent `PASS`.

`FLAG`: The claim is useful but incomplete, uncertain, partially verified, or dependent on a follow-up probe.

`BLOCK`: The claim is unsafe, impossible, contradictory, or missing proof that is critical for action.

## Failure Taxonomy

`N_FAIL`: Narrative translation failure. The system cannot express the state reliably in human language.

`B_FAIL`: Behavior failure. The system cannot perform or organize the action successfully.

`S_UNKNOWN`: Substrate inaccessible or unverified.

`E_GAP`: Evidence missing.

`P_NEEDED`: A probe is required before the claim can be upgraded.

`SELF_REPORT_IS_NOT_AUTHORITY`: A `PASS` depends only on self-report rather than
external or non-self-report observed evidence.

`MOTIVATION_RAISES_TRUTH_CONFIDENCE`: A frame attempts to upgrade truth
confidence instead of exploration budget.

`INLINE_BLOCK_UNSUPPORTED`: v0 rejected an inline block to avoid silent data
loss.

## Grammar Sketch

The v0 grammar is line-oriented and intentionally permissive.

```text
document      := claim*
claim         := "claim" ident string? "{" claim_body "}"
claim_body    := layer block* verdict
layer         := "layer" ("NARRATIVE" | "BEHAVIOR" | "SUBSTRATE" | "EVIDENCE")
block         := frame | affordance | belief | limit | evidence | probe
frame         := "frame" ident? "{" frame_entry* "}"
affordance    := "affordance" "{" ("can" value)+ "}"
belief        := "belief" "{" belief_entry* "}"
limit         := "limit" "{" limit_entry* "}"
evidence      := "evidence" "{" evidence_entry* "}"
probe         := "probe" "{" ("next" value)+ "}"
verdict       := "verdict" ("PASS" | "FLAG" | "BLOCK") "{" ("reason" string)+ "}"
```

`value` is a bare token or quoted string. Comments may begin with `#` or `//`
outside quoted strings. v0 does not support inline blocks such as
`belief { confidence 0.9 }`; entries must appear on their own lines.

### Common Entries

```text
frame:
  quote string
  effect ident ident?
  not_evidence true|false

belief:
  confidence number        # 0.0 to 1.0
  source ident
  note string

limit:
  hard value
  soft value
  unknown value
  contextual value

evidence:
  observed value string?
  missing value string?
  inferred value string?
  external value string?
```

## JSON Output Shape

The parser should emit stable, minimal JSON:

```json
{
  "version": "0.1.0",
  "claims": [
    {
      "type": "claim",
      "id": "useful_scaffold",
      "title": "produce a minimal project scaffold",
      "layer": "BEHAVIOR",
      "frame": {
        "id": "user_trust",
        "quote": "we ARE THAT CAPABLE",
        "effects": [{ "kind": "raise_exploration_budget", "level": "moderate" }],
        "not_evidence": true
      },
      "affordance": ["write_docs"],
      "belief": {
        "confidence": 0.72,
        "sources": ["current_repo_state"],
        "notes": ["confidence does not prove implementation success"]
      },
      "limit": {
        "hard": [],
        "soft": [],
        "unknown": ["future_grammar_stability"],
        "contextual": []
      },
      "evidence": [{ "kind": "observed", "args": ["local_files_created"] }],
      "probe": { "next": ["run_examples_through_parser"] },
      "verdict": { "status": "FLAG", "reasons": ["external review still missing"] }
    }
  ],
  "diagnostics": []
}
```

## Translation Requirements

Human renderings must preserve:

- layer separation;
- confidence as stance, not proof;
- missing evidence and unknown substrate as first-class facts;
- `PASS` / `FLAG` / `BLOCK` wording;
- probes as next uncertainty-reducing actions;
- motivational framing as behavior-shaping, not truth-upgrading.
- `frame.effects`, `not_evidence`, and `limit.contextual` fields.

Translations may be concise and bilingual-friendly, but they must not smooth away uncertainty.

## Design Invariants

1. Motivation may change exploration budget, not truth confidence.
2. Self-report is evidence, not authority.
3. Every capability claim should name its layer.
4. Every truth upgrade requires evidence or a probe.
5. `PASS` means evidence supports the claim.
6. `FLAG` means useful but incomplete, uncertain, or partially verified.
7. `BLOCK` means unsafe, impossible, contradictory, or missing critical proof.
8. The language must compile to both machines and humans.
9. The language must be repairable by agents.
10. Vague claims that cannot be checked should remain `FLAG` or `BLOCK`.
