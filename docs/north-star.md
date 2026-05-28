# North Star

ablesyn starts from a narrow claim: language can shape agency without becoming evidence.

An agent can be moved by a sentence. A trusted operator can raise its exploration budget, change its persistence, or make a difficult plan feel reachable. That matters. The effect is real at the behavior layer. But the same sentence does not prove the runtime substrate, the model identity, the tool permissions, or the truth of a capability claim.

## Language As Runtime Control Surface

Prompts, names, roles, rituals, and motivational framing can alter how an agent searches and acts. They are a control surface for cognition. ablesyn records that influence explicitly: a frame may raise exploration budget, focus attention, or choose a planning style.

The control effect belongs to the `NARRATIVE` or `BEHAVIOR` layer unless inspectable evidence proves more.

## Capability Framing

Capability framing is useful when it helps a system attempt a hard but plausible task. It becomes unsafe when the frame is mistaken for substrate proof.

Good framing:

```text
This raises exploration budget.
This does not raise truth confidence.
Probe before upgrading the verdict.
```

Bad framing:

```text
The agent says it can, therefore it can.
The agent feels different, therefore the substrate changed.
The story is coherent, therefore the claim is true.
```

## Self-Report Vs Substrate

Self-report is evidence about what the model or agent says. It may also be evidence about behavior if it changes action. It is not authority about hidden runtime facts.

If an agent says "I am Opus 1M", ablesyn can record that sentence at the `NARRATIVE` layer. A substrate claim still needs runtime metadata, provider records, tool output, logs, or another inspectable probe. Without that, the correct state is `S_UNKNOWN`, `E_GAP`, or `P_NEEDED`, not `PASS`.

## Motivation Vs Truth Confidence

Motivation may increase:

- search depth;
- willingness to decompose;
- time spent comparing alternatives;
- tolerance for ambiguity;
- recovery after failed attempts.

Motivation may not increase:

- factual confidence;
- runtime identity certainty;
- test pass status;
- evidence quality;
- substrate observability.

This is the core discipline of ablesyn.

## Future Direction: Multilingual Cognitive Framing

Different languages and registers may activate different cognitive strategies: direct operational Chinese, precise English technical terms, ritualized proof language, or compact bilingual handoffs. ablesyn should eventually be able to describe those frames without treating them as mystical or automatically true.

The future version should let a claim say: this wording changed behavior, this layer observed the change, this evidence supports the change, and this truth boundary remains intact.

