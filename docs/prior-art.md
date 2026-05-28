# Prior Art And Shoulders

ablesyn is not vendoring these projects. This file records nearby ideas and useful pressure points. Public repo pages were checked on 2026-05-28 where possible; some relevance notes are inferred from user-provided direction and should be rechecked before strong public claims.

## Primary References

- [google/ax](https://github.com/google/ax): Agent Executor describes a distributed agent runtime with a controller, event log, resumption, auditing, policy, and single-writer state. For ablesyn, the useful shoulder is not runtime scale; it is the discipline of resumable, auditable execution state. The user-provided `thockin/ax` pointer appears to refer to the AX line of work, but the substantive public repo observed in this pass is `google/ax`.
- [agent-substrate/substrate](https://github.com/agent-substrate/substrate): Agent Substrate maps many stateful actors onto fewer workers, with actor lifecycle, suspend/resume, preserved RAM/filesystem state, and high-density workload multiplexing. For ablesyn, this is substrate vocabulary: runtime fact is separate from narrative report.
- [perplexityai/bumblebee](https://github.com/perplexityai/bumblebee): Bumblebee is a read-only developer endpoint scanner that emits structured inventory records, uses confidence levels, avoids mutation, and includes selftest fixtures. For ablesyn, this is a model for substrate/inventory probes that do not change the system being inspected.
- [ai4society/GenAIResultsComparator](https://github.com/ai4society/GenAIResultsComparator): GAICo provides metrics for comparing generated outputs across text, structured data, and multimodal cases. For ablesyn, the useful idea is a metric registry that can compare claims, evidence, and verdict quality.
- [rocicorp/mono](https://github.com/rocicorp/mono): Rocicorp's monorepo contains Replicache and Zero work around local-first sync and incremental view maintenance. For ablesyn, the relevant idea is derived views over changing state: claim views should be recomputable from evidence events.
- [facebookresearch/ProgramBench](https://github.com/facebookresearch/ProgramBench): ProgramBench asks whether agents can reconstruct programs from binaries and docs. For ablesyn, the analogous benchmark is reconstructing capability state from traces, self-report, and substrate probes.
- [vercel-labs/zerolang](https://github.com/vercel-labs/zerolang): zerolang exposes agent-friendly language facts, JSON diagnostics, repair-oriented compiler output, and version-matched rules. For ablesyn, the shoulder is compiler-native facts instead of prose-only guidance.
- [oven-sh/bun](https://github.com/oven-sh/bun): Bun is a fast JavaScript/TypeScript runtime, package manager, and test runner. For ablesyn v0, Bun keeps parser experiments small and cheap to run.
- [mastra-ai/mastra](https://github.com/mastra-ai/mastra): Mastra is a TypeScript agent framework with workflows, routing, memory, evals, observability, and MCP integration. For ablesyn, the boundary is important: ablesyn can sit beside frameworks like this rather than becoming one.

## Additional Nearby Work

- [BoundaryML/baml](https://github.com/BoundaryML/baml): typed prompt functions and schema engineering.
- [guidance-ai/guidance](https://github.com/guidance-ai/guidance): constrained generation via grammars and control structures.
- [dottxt-ai/outlines](https://github.com/dottxt-ai/outlines): structured generation with regex/CFG-like constraints.
- [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai): typed agents, evals, durable execution patterns, and observability.
- [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph): stateful, long-running graph execution for agents.
- [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk): standard boundary for tools and context.
- [temporalio/temporal](https://github.com/temporalio/temporal): durable execution as a production baseline.
- [langfuse/langfuse](https://github.com/langfuse/langfuse) and [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix): traces, evals, and observability.
- [UKGovernmentBEIS/inspect_ai](https://github.com/UKGovernmentBEIS/inspect_ai) and [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo): evals, red-teaming, and testable prompt behavior.
- [rerun-io/rerun](https://github.com/rerun-io/rerun): possible future layer for multimodal and physical-AI time-series evidence.
- [electric-sql/electric](https://github.com/electric-sql/electric): possible future sync substrate for evidence and derived claim state.

