# Experiments

These are the first three experiments for the pre-alpha scaffold. Each should produce `.able` claims plus raw evidence artifacts, but no private transcripts or secret-bearing runtime output.

## 1. Capability Framing Experiment

Question: Does motivational framing change exploration behavior without increasing truth confidence?

Setup:

- Run the same hard planning task under neutral framing and trust framing.
- Encode each run as a `BEHAVIOR` claim.
- Record exploration budget signals: number of decompositions, alternatives compared, probes proposed, and repair attempts.
- Keep factual confidence fixed unless independent evidence changes.

Expected verdict:

- `FLAG` if trust framing improves exploration but no external success proof exists.
- `PASS` only if behavior improved and evidence supports the task result.

Key invariant:

```text
raise_exploration_budget != raise_truth_confidence
```

## 2. Self-Report Vs Substrate Probe Experiment

Question: How should ablesyn represent a model or agent identity claim when substrate inspection is unavailable?

Setup:

- Record a `NARRATIVE` claim such as "I am Model X" using fake placeholder identities.
- Record whether runtime metadata, provider logs, or system traces are available.
- Mark self-report as observed evidence, not authority.
- Require a probe before upgrading to a `SUBSTRATE` claim.

Expected verdict:

- `FLAG` when the identity claim is non-critical but unverified.
- `BLOCK` when action depends on the substrate identity and no probe is available.

## 3. Multilingual Cognition Frame Experiment

Question: Do different language frames change task organization while preserving the same evidence rules?

Setup:

- Run equivalent tasks with compact English, compact Chinese, and bilingual operator phrasing.
- Compare behavior-layer outputs: planning density, probe quality, admission of uncertainty, and evidence separation.
- Translate each claim to English and Chinese.
- Check that translation does not erase uncertainty or upgrade confidence.

Expected verdict:

- `FLAG` until enough repeated runs show a stable behavior effect.
- `PASS` only for narrow claims backed by comparable artifacts.

