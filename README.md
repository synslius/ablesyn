# ablesyn

ablesyn is a small language for saying what an agent or system can try, why it believes it can try it, what limits remain, what evidence exists, and what probe should happen next. It is a cognition and evidence contract layer: readable by people, parseable by machines, and intentionally modest about what self-report can prove.

## North Star

> Language can activate agency, but it must not corrupt truth.
>
> Motivation may raise exploration budget. It may not raise truth confidence.

## Why This Exists

Agents often speak in one layer while being judged in another. A model may report an identity, act differently because of that narrative, and still lack reliable introspective access to the runtime substrate. ablesyn makes that split explicit: narrative claims are evidence, not authority; behavior is observable, not necessarily explained; substrate facts need inspection; truth upgrades require evidence or a probe.

## What It Is Not

ablesyn is not an agent framework, orchestration runtime, eval platform, or belief engine. It does not run tools for you, claim model self-awareness, or replace tests and logs. It is a small contract language for describing capability, belief, limits, evidence, probes, and verdicts without letting motivational language inflate truth confidence.

## Core ABLE Fields

| Field | Purpose |
| --- | --- |
| `affordance` | What the agent or system can attempt under current conditions. |
| `belief` | The current stance or confidence, with sources and notes. |
| `limit` | Hard, soft, unknown, or contextual boundaries. |
| `evidence` | Observed proof, missing proof, inferred proof, or external references. |
| `probe` | The next action that would reduce uncertainty. |
| `verdict` | `PASS`, `FLAG`, or `BLOCK`. |
| `layer` | `NARRATIVE`, `BEHAVIOR`, `SUBSTRATE`, or `EVIDENCE`. |
| `translation` | Human rendering that preserves uncertainty and layer boundaries. |

## Quick Example

```able
claim useful_scaffold "produce a minimal project scaffold" {
  layer BEHAVIOR
  affordance {
    can write_docs
    can create_examples
    can run_parser_check
  }
  belief {
    confidence 0.72
    source current_repo_state
    note "confidence applies to producing a useful scaffold, not proving future runtime scale"
  }
  limit {
    unknown future_grammar_stability
  }
  evidence {
    observed local_files_created "docs, schemas, examples, parser"
    missing external_user_review
  }
  probe {
    next run_examples_through_parser
  }
  verdict FLAG {
    reason "useful first scaffold; external review still missing"
  }
}
```

## Status

Pre-alpha / research scaffold. The v0 parser is intentionally permissive and exists to make the first examples executable. The grammar, schema, and checker rules are expected to change.

## License And Attribution

ablesyn is licensed under Apache-2.0. Copyright 2026 Hengyaun Zhu.

Public identity note: `synslius` and `Fearvox` are public research faces used by the same author. The names reflect different research orientations and public contexts, not separate authorship for this repository.

## Public-Surface Safety

This is a public repo. Do not commit secrets, API keys, private paths, raw chat transcripts, screenshots, local machine identifiers, credentials, model API tokens, private runtime IDs, or auth payloads. Examples should use fake placeholders and public repository names only.

## Local Commands

```sh
bun run ablesyn parse examples/capability-claim.able --json
bun run ablesyn check examples/hello.able
bun run ablesyn translate examples/capability-claim.able --to en
bun run ablesyn translate examples/capability-claim.able --to zh
bun run test
```
