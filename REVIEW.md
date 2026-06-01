# ablesyn 全仓 Review — REVIEW.md

> 来源：dynamic workflow `ablesyn-full-repo-review`（2026-05-28）。
> 90 个 subagent / 3.6M token / 7m44s。7 维度 finder → 每条发现 2 个对抗 skeptic 验真 → 综合。
> 候选 41 条 → **confirmed 39 / contested 1 / rejected 1**。
> 每条 confirmed 均经两名独立验证员复核（多附 `bun` 运行证据）。

## 修复进度

- ✅ **A1 + A2 已修**（2026-05-28，TDD，PR #2）— `src/check.ts` self-report 授权检查从「仅 SUBSTRATE 层 + 字面量 `self_report` + 仅 observed」扩为「任意层 PASS + 结构化识别（observed/inferred，token 精确或 `self_report_` 前缀 + `belief.source`）+ 无 external/非-self-report-observed 佐证即报错」。新增回归：`tests/fixtures/pass-self-report-{nonsubstrate,aliased,with-external}.able` + 4 个断言。
- ✅ **A4 已修**（2026-05-28，TDD）— `src/check.ts`：无 observed/external/inferred 任何证据的 PASS 从 warning 升为 error `PASS_WITHOUT_EVIDENCE`（仅-inferred 仍保留软 warning）。回归 `tests/fixtures/pass-without-evidence.able`。
- ✅ **B1 已修**（2026-05-28，TDD）— `src/cli.ts`：每文件读取包 try/catch，不可读文件打印 `ERROR CANNOT_READ` 并 `continue`，批处理不再因单个坏路径崩溃中断后续文件。
- ✅ **B2 已修**（2026-05-28，TDD）— `src/cli.ts`：`check` 状态词从 PASS/BLOCK 改为 OK/FAIL，不再把 lint 结果挪用 verdict 词汇（招牌 BLOCK 示例不再显示 PASS）。B1+B2 回归见 `tests/cli.test.ts`。
- ⬜ 其余 confirmed 见下表（Medium/Low：parser 行内块静默吞数据、`claim {` 把大括号当 id、translate 丢 `frame.effects`/`limit.contextual`、schema-vs-types 契约漂移、invariant #1 零测试 等）。

---

# ablesyn Code Review

## 一句话总体评价

这是一个刻意精简的 v0 evidence-contract DSL，核心安全不变式 (#1 motivation、#2 self-report) 已实现但**实现方式过于脆弱、覆盖不全**——多个 SPEC 不变式仅靠魔法字符串/前缀匹配“近似执行”，且 parser、schema、types、CLI 四层之间存在系统性契约不一致；按 v0 标准衡量，逻辑骨架成立，但其声称要捍卫的“真值升级需要证据”这件事本身存在可绕过的口子。

---

## Critical / High 问题

### A. 安全不变式执行不到位（最严重一类，全在 `src/check.ts`）

**A1. self-report 授权检查只防 SUBSTRATE 层 — `check.ts:65-67`**
`if (selfReportObserved && claim.layer === "SUBSTRATE" && !nonSelfReportEvidence)`。SPEC line 20 明确 self-report “cannot authorize a substrate **OR truth** claim”，而任意层的 PASS 都是真值升级 (#4)。一个 layer 为 BEHAVIOR/EVIDENCE、唯一证据是 `observed self_report ...` 的 PASS 完全干净通过（`observed` 还满足了 `observedEvidence`，连 warning 都不触发）。
**Fix:** 把该检查改为对任意层 PASS 生效；若 SUBSTRATE 要更严，则其他层至少降为 warning。

**A2. self-report 探测器靠魔法串 `args[0]==="self_report"` + 仅 `observed` — `check.ts:50-53`**
`inferred self_report`、`observed self_report_identity`、或经 `belief.source self_report` 记录的 self-report 全部绕过 `selfReportObserved`，于是 A1 那条 error 永不触发。该约定 SPEC 未文档化，作者无从得知必须精确写 `observed self_report`。
**Fix:** 用结构化字段判定 self-report（kind ∈ {observed, inferred} 且 source 标识，含 `belief.source`），并在 SPEC 文档化该约定。

**A3. MOTIVATION_NOT_EVIDENCE 仅匹配 `raise_` 前缀，且 `not_evidence true` 被当作“免罪” — `check.ts:38-46`**
不变式 #1 = 动机可改探索预算、**不可改真值置信**。当前实现 (a) 抓不到任何不叫 `raise_*` 的提升置信效果（如 `change_identity_frame strong`、`boost_confidence`）；(b) 更严重：把 `not_evidence true` 当作中和提升置信效果的方式，但 #1 是绝对禁止动机改真值置信，贴个标签不能使其合法。它把“改预算（允许）”和“改置信（禁止）”混进同一个正则。且这只是 warning，不阻断。
**Fix:** 区分 effect 目标——预算类允许；置信类无论 `not_evidence` 与否都是 error。维护显式的 budget-effects / confidence-effects 集合，而非前缀。

**A4. 零证据零探针的 PASS 只 warning、永不阻断 — `check.ts:59-64`**
不变式 #4 + SPEC line 36（missing critical proof / open probes should prevent PASS）。无 observed/external/inferred 证据、无 probe 的 PASS 只产生 `PASS_WITHOUT_OBSERVED_EVIDENCE`（warning），`result.ok`（line 77 仅看 error）仍为 true。唯一硬 error 是显式 `missing` 证据存在时。空证据真值升级直接放行。
**Fix:** PASS 既无 observed/external/inferred 证据又无 probe 应为 error。

### B. CLI 健壮性（`src/cli.ts`）

**B1. 不存在/不可读文件抛未捕获 rejection，整批中断 — `cli.ts:32`**
`await Bun.file(file).text()` 无 try/catch。`check a.able /tmp/missing.able b.able` 会在第一个文件后崩溃并打印原始 ENOENT stack，第三个文件**永不被检查**。对“逐文件出 verdict”的工具是正确性失败；line 70 的 `process.exit` 永不到达。
**Fix:** 在循环内 try/catch，读取失败打印干净诊断、`hadError=true`、`continue`。

**B2. `check` 对 verdict 为 BLOCK 的文档打印 PASS — `cli.ts:51`**
`${result.ok ? "PASS" : "BLOCK"}`，而 `result.ok` 只表示“无 error 级诊断”，与 claim 自身 verdict 正交。`check examples/self-verification.able`（其 claim 是规范的 `verdict BLOCK` 案例）输出 `PASS`。直接把 SPEC 的 PASS/FLAG/BLOCK verdict 词汇挪用为 lint-clean 语义，且发生在招牌 BLOCK 示例上。
**Fix:** CLI 状态改用 OK/FAIL 或 CLEAN/ERRORS，避免与 verdict 词汇冲突；或单独呈现 claim verdict。

**B3. `--to` 吞掉唯一位置文件名，报错 “No .able files provided” — `cli.ts:19-21,87-90`**
`readOption` 与 `positionalFiles` 都无条件把 `--to` 后一个 token 当值。`translate --to examples/hello.able` 把文件名吃成翻译目标 → files 为空 → 误报；`translate --to --json file` 把 `--json` 当目标 → “Unsupported translation target: --json”。
**Fix:** 校验 `--to` 值，拒绝以 `--` 开头或不在 {en,zh} 的后续 token，缺/非法值显式报错。

### C. 翻译丢失 SPEC 要求保留的载荷（`src/translate.ts`）

**C1. `frame.effects`（探索预算信号）en/zh 渲染全丢 — `translate.ts:28-34,51-57`**
frame 行只渲染 id/quote/not_evidence，从不渲染 effects（如 `raise_exploration_budget: moderate`）。这正是 SPEC line 150 要求呈现的“behavior-shaping 动机”、也是 `check.ts:38` 视为安全相关的信号。人读译文看不出探索预算被抬高。
**Fix:** frame 行追加 `effects <kind:level,...>`，zh 用 `效果`。

**C2. `limit.contextual` en/zh 全丢 — `translate.ts:22,45`**
Limits 行只渲染 hard/soft/unknown。`contextual` 是 SPEC 一等字段、parser 已填充 (`parse.ts:173`)，却从不输出。人读译文看到的约束少于实际。
**Fix:** 两个渲染都加 `contextual ${joinOrNone(claim.limit.contextual)}`。

### D. Schema / Types 契约矛盾（高）

**D1+D2. schema 要求 `layer`/`verdict` 但 TS 声明可选、parser 常态省略 — `schemas/ablesyn-claim.schema.json:6`**
两字段都在 schema `required` 中，但 `types.ts:32/50` 为可选，`makeClaim`（`parse.ts:215-236`）不初始化它们，缺失时 parser **不报诊断**。于是 `parseAble` 能返回一个 TS 合法、却被项目自有 claim schema 拒绝的 `AbleDocument`——这是同一类 schema-vs-types 矛盾，发生在两个 load-bearing 字段上。（注：`check.ts` 后续会报 MISSING_LAYER/MISSING_VERDICT，但 parse 阶段与 schema 仍矛盾。）
**Fix:** 选一个真相源：要么从 schema `required` 移除并交给 check 去 FLAG/BLOCK；要么 TS 改必填 + parser 缺失时报诊断/省略不完整 claim。

### E. 测试缺口（高）

**E1. 不变式 #1（MOTIVATION_NOT_EVIDENCE）零测试零 fixture — `tests/parse.test.ts`**
唯一带 `raise_` 的示例 (`capability-claim.able`) 设了 `not_evidence true` 把 warning 压住；`self-verification.able` 的 effect 不以 `raise_` 开头。SPEC 第二核心不变式完全未验证，反转/删除 `not_evidence` 判断不会让任何测试失败（它是 warning，连 `.ok` 都不影响）。
**Fix:** 加一个 `effect raise_exploration_budget moderate` + `not_evidence false` 的 fixture 断言该诊断触发，并配一个 `not_evidence true` 抑制的负例。

---

## Medium 问题

**Parser（全在 `src/parse.ts`）**

- **行内块体被静默丢弃 — `parse.ts:71-100,117-120`**（block-open 仅当末 token 为 `{` 时触发）。`belief { confidence 0.9 }` 只产生空 belief + 一条 IGNORED_TOP_LEVEL，`confidence` 丢失；最坏 `verdict FLAG { reason "x" }` 命中 line 107 裸 verdict handler，记下 status=FLAG 但**无任何诊断**地丢弃 reason。Fix: 显式拒绝行内闭合块并报诊断。
- **`claim {` 把字面量大括号当作 id — `parse.ts:56-60`**：`id="{"` 为 truthy，CLAIM_ID 不触发，凭空造出 id 为 `{` 的 claim、无诊断。Fix: `if (!id || id === "{")` 报 CLAIM_ID。
- **`} extra` 不被当作闭合 — `parse.ts:33-45`**（要求 `length===1`）：被当成块条目 key（`Unknown belief entry: }`），块/claim 永不闭合 → 末尾误报 UNCLOSED_CLAIM，诊断指向错位置。
- **大括号粘连相邻字符不被切分 — `parse.ts:270`**：`\S+` 贪婪吃掉 `{`/`}`，`belief{` → 单 token，永不开块 → IGNORED_TOP_LEVEL。Fix: 让 `{`/`}` 始终从相邻 run 中切出。
- **多 token title 静默截断 — `parse.ts:61-62`**：`tokens.length>3 ? tokens[2] : undefined` 只取 tokens[2]，`claim foo bar baz {` 丢掉 `baz`，无诊断。

**Spec-conformance**

- **parser 输出顶层 `source` 字段未在 SPEC JSON Output Shape 中 — `parse.ts:132-137`**：文档约定为 `{version,claims,diagnostics}`，实际多了 `source`。Fix: 二选一对齐（文档化或移除）。
- **claim `id` pattern 从不校验 — `parse.ts:56-62`**：schema 限定 `^[A-Za-z_][A-Za-z0-9_-]*$`，但 `claim 123foo {`、`claim "has spaces" {` 都通过并产出 schema 会拒绝的 id。

**Schema/Types 一致性**

- **`frame.effects` schema 可选但 TS 必填 — `schema:23-43` vs `types.ts:16`**：`"frame": {"id":"x"}` 过 schema 但不满足 TS。Fix: schema 加 `"required":["effects"]`（parser 总是构造 `effects:[]`，此为低风险方向）。
- **event schema 无对应 TS 类型 — `schemas/ablesyn-event.schema.json`**：无 `AbleEvent`，其 layer/verdict 枚举手抄自 types.ts，可静默漂移。
- **缺 AbleDocument / AbleDiagnostic 的 JSON Schema**：工具实际产出的 wrapper 无 schema 可校验，没东西能发现 parser 输出不符 claim schema。

**测试缺口**

- **translate.ts 整个模块零测试**（zh 路径、frame splice 全未跑）；
- **parser 错误/诊断路径零测试**（UNCLOSED_*, NESTED_*, CLAIM_ID 等全未喂 malformed 输入）；
- **checkDocument 多数诊断码未测**（仅 SELF_REPORT_IS_NOT_AUTHORITY 被断言，INVALID_CONFIDENCE / PASS_WITH_MISSING_EVIDENCE 等守 #4/#5 的分支无测试）。

---

## Low 问题（简列）

- **无 BLOCK/contradiction 检查 — `check.ts`**：PASS 同时带 `hard` limit（如 `cannot_verify_unfetched_repos`）不被判矛盾；invariant 7/10 BLOCK 分类基本未执行。（评 medium 但本质是完整性缺口）
- `unquote` 不处理 `\t` 等转义，replace 链顺序使 `\\n` 被错误处理，未终止引号原样穿透无诊断 — `parse.ts:273-282`。
- 裸 token value 用单空格 join，可静默融合本应分开的 token / 折叠空白 — `parse.ts:147-148`。
- `not_evidence ?? false` 把“未设置”与“显式 false”都渲染成 `false` — `translate.ts:32,55`。
- 裸 `verdict STATUS` 行形式 grammar 未描述、且允许零 reason — `parse.ts:107-115`。
- 空 affordance/probe/verdict 块违反 grammar `+` 仍被接受 — `parse.ts:154-199`。
- `layer FOO` 无校验直接进 JSON（`parse --json` 输出 schema-invalid，无诊断；check 才抓） — `parse.ts:102-104`。
- schema 枚举与 TS 联合体手工重复、无生成/测试绑定，易漂移 — `types.ts:1-3`。
- SELF_REPORT 测试未 pin 反例（加非 self-report 证据应放行 / FLAG-BLOCK 应允许）— `tests/parse.test.ts:29-36`。
- 无 title 分支 / `title === "{"` fallback 未测 — `parse.ts:61-62`。
- `belief.notes`（confidence-as-stance 注脚）渲染时丢失 — `translate.ts:21,44`（评 medium）。

---

## Contested 问题（分歧单列）

**证据 kind（missing/inferred）未区分呈现、扁平成一个列表 — `translate.ts:23,46`**
事实无争议：所有证据被 join 成一个逗号串 `observed:a, missing:b, inferred:c`。
- **分歧点**：kind 前缀**确实保留**在每条内联（`missing:b` 可见、从不丢弃，空数组还输出 `none`）。一方认为 SPEC line 145“missing evidence 作为一等事实”仅要求**保留**该事实、并未要求视觉分组/强调，故只是风格偏好、非缺陷；且 verdict 在独立行渲染，evidence 行格式不影响 PASS/BLOCK 判定（判定全在 check.ts）。另一方认为把 missing/inferred 与 observed 同等权重并列，确实抹平了 SPEC 要求保留的不确定性梯度。
- **我的裁断**：倾向“真实但低危”——数据未丢、不影响 verdict，属呈现层 altitude 问题，可按 nice-to-have 处理（按 kind 分组或排序，仅 missing/inferred 时加 “none observed” 提示）。

---

## 最值得先修的 Top 3

1. **A1 + A2（self-report 授权口子）— `check.ts:50-67`**：这是 ablesyn 存在的理由（#2 self-report is not authority）。当前任何非 SUBSTRATE 层、或换个写法（`inferred`/`self_report_identity`/`belief.source`）的 self-report 都能授权 PASS。修这两条 + 在 SPEC 文档化 self-report 表示约定。
2. **A4（零证据 PASS 不阻断）— `check.ts:59-64`**：违反 #4 最直接——“真值升级需要证据或探针”当前可被空证据 PASS 绕过。把它从 warning 升为 error。
3. **B1 + B2（CLI 正确性）— `cli.ts:32,51`**：B1 让批量检查在第一个坏路径处静默漏检后续文件；B2 让招牌 BLOCK 示例显示 PASS。两者都直接破坏工具对外契约且零成本可修。

（次优先建议：补 E1 的 invariant #1 回归测试，因为第二核心不变式目前完全无测试守护。）

---

## 附录：confirmed 发现结构化清单（按严重度）

| 严重度 | 位置 | 类别 | 问题 | 修复建议 |
|---|---|---|---|---|
| HIGH | `schemas/ablesyn-claim.schema.json:6, 19-22` | spec-mismatch | Claim schema requires `layer` but TS makes it optional and the parser emits claims without it | Pick one source of truth. Either (a) drop `layer` from the schema `required` list and have check.ts FLAG/BLOCK missing layer per invariant 3, or (b) make `layer` required in the TS interface AND have parse.ts emit a diagnostic + omit incomplete claims (or default) so emitted output always satisfies the schema. |
| HIGH | `schemas/ablesyn-claim.schema.json:6, 108-122` | spec-mismatch | Claim schema requires `verdict` but TS makes it optional and the parser routinely omits it | Decide whether verdict is mandatory. If verdict is required by the contract, remove the `?` in TS and have the parser emit a default verdict (e.g. FLAG with a `verdict-missing` reason) plus a diagnostic; otherwise remove `verdict` from the schema `required` list. |
| HIGH | `src/check.ts:65-67` | spec-mismatch | SELF_REPORT_IS_NOT_AUTHORITY only guards SUBSTRATE-layer PASS; truth claims at other layers escape | Apply the self-report-only authority check to any PASS verdict regardless of layer: if the only evidence supporting a PASS is self-report, emit SELF_REPORT_IS_NOT_AUTHORITY. If SUBSTRATE is meant to be stricter, keep it an error there and at least a warning elsewhere. |
| HIGH | `src/check.ts:50-53` | robustness | Self-report authority detector keys on literal args[0]==="self_report" and only kind "observed" | Treat any evidence whose kind is observed OR inferred and whose source/args identify self-report (and/or belief.source === 'self_report') as non-authoritative. Document the self_report token convention in SPEC, or detect via a structured field rather than args[0] string matching. |
| HIGH | `src/check.ts:38-46` | spec-mismatch | MOTIVATION_NOT_EVIDENCE detector (startsWith "raise_") does not enforce invariant 1's actual prohibition | Distinguish effect targets: an effect that changes exploration/search budget is allowed (optionally requiring not_evidence); an effect that raises truth/belief confidence should be an error regardless of not_evidence. Maintain an explicit set of budget-affecting vs confidence-affecting effect kinds rather than a `raise_` prefix. |
| HIGH | `src/check.ts:59-64` | spec-mismatch | PASS with no supporting evidence and no probe is only a warning, never blocks (invariant 4) | Make PASS with neither observed/external evidence nor any other supporting basis an error (it does not satisfy invariant 4). At minimum, PASS with no observed/external/inferred evidence AND no probe should be PASS_WITH_MISSING_EVIDENCE-level error. |
| HIGH | `src/cli.ts:32` | robustness | Missing/unreadable file throws an unhandled rejection that crashes the process and aborts the whole batch | Wrap the read+parse+per-command work in a try/catch inside the loop. On read failure, print a clean diagnostic like `${file}: ERROR cannot read file (ENOENT)`, set hadError=true (or print BLOCK for check), and `continue` so remaining files are still processed. Reach line 70 so the exit code is intentional. |
| HIGH | `src/cli.ts:19-21,87-90` | robustness | --to swallows the only positional filename, yielding spurious 'No .able files provided' | Validate the --to value: reject (or do not consume) a following token that starts with '--' or that does not match the known target set en|zh. Treat a missing/invalid value as an explicit error rather than greedily eating a filename. Consider validating --to before the file loop so the message is 'missing/invalid --to value' rather than 'No .able files provided.' |
| HIGH | `src/cli.ts:51` | spec-mismatch | `check` CLI prints PASS for a document whose claim verdict is BLOCK | Either rename the CLI check status (e.g. OK/FAIL or CLEAN/ERRORS) to avoid colliding with verdict vocabulary, or surface the claim verdict separately. Add a test asserting the check CLI does not report PASS for the BLOCK self-verification example. |
| HIGH | `src/parse.ts:71-100, 117-120` | bug | Inline block bodies are silently dropped (open + content + close on one line) | Either explicitly reject inline-closed blocks with a diagnostic (e.g. ONELINE_BLOCK_UNSUPPORTED) so content is never silently lost, or properly tokenize/parse a `name { ... }` one-liner. At minimum, the bare `verdict` line-handler should detect a following `{` and not silently drop the brace-delimited body. |
| HIGH | `src/translate.ts:28-34, 51-57` | spec-mismatch | frame.effects (exploration-budget signal) silently dropped from human rendering | Render effects in the frame line, e.g. `Frame: <id>; quote <q>; effects <kind:level, ...>; not evidence <bool>`, using joinOrNone over claim.frame.effects.map(e => e.level ? `${e.kind}:${e.level}` : e.kind). Mirror in zh with `效果`. |
| HIGH | `src/translate.ts:22, 45` | spec-mismatch | limit.contextual silently dropped from both en and zh renderings | Add `; contextual ${joinOrNone(claim.limit.contextual)}` to the Limits/边界 line in both renderEn and renderZh. |
| HIGH | `tests/parse.test.ts:1-36` | test-gap | MOTIVATION_NOT_EVIDENCE invariant (#1) has no test or fixture | Add a fixture with `effect raise_exploration_budget moderate` and `not_evidence false` (or omitted) and assert the MOTIVATION_NOT_EVIDENCE diagnostic is emitted; add a paired negative case where not_evidence true suppresses it. |
| MEDIUM | `schemas/ablesyn-claim.schema.json:23-43` | consistency | Schema `frame.effects` is optional but TS `AbleFrame.effects` is required | Add `"required": ["effects"]` to the `frame` object in the schema (matching TS), or make `effects?` optional in the TS interface. Note parse.ts always constructs `effects: []`, so making the schema require it is the lower-risk fix. |
| MEDIUM | `schemas/ablesyn-claim.schema.json:n/a` | test-gap | No JSON Schema for AbleDocument / AbleDiagnostic (the actual parser output) | Add an ablesyn-document.schema.json with `version` const "0.1.0", optional `source`, `claims` array referencing the claim schema via `$ref`, and a `diagnostics` array (with a diagnostic sub-schema whose `severity` enum is error|warning matching DiagnosticSeverity). Add a test that validates real parser output against it. |
| MEDIUM | `schemas/ablesyn-event.schema.json:1-37` | consistency | Event schema has no corresponding TypeScript type | Add an `AbleEvent` interface (and a `AbleEventType` union) to src/types.ts that mirrors the event schema, reusing `AbleLayer`/`AbleVerdict` so the shared enums cannot diverge. If events are not yet implemented, mark the schema as draft/unused to avoid implying parity. |
| MEDIUM | `src/check.ts:n/a` | spec-mismatch | No check enforces BLOCK / FLAG semantics or detects contradictions (invariants 7, 10) | Add a check: a PASS (or FLAG) verdict combined with a `hard` limit expressing impossibility/unverifiability is a contradiction and should at least warn (BLOCK candidate). Consider flagging PASS when `limit.unknown` references the very subject of the claim. |
| MEDIUM | `src/check.ts:14-73` | test-gap | Most checkDocument diagnostic codes are untested | Add focused unit tests calling checkDocument on small synthetic AbleDocument objects (or fixtures) that trigger each diagnostic code, especially PASS_WITH_MISSING_EVIDENCE and INVALID_CONFIDENCE which guard invariants #4/#5. |
| MEDIUM | `src/cli.ts:21` | robustness | --to with no following argument silently defaults to 'en' instead of erroring | Distinguish 'flag absent' from 'flag present but value missing'. If --to appears with no value (or a value starting with '--'), emit an error like 'Error: --to requires a value (en|zh)' and exit 1, rather than defaulting to en. |
| MEDIUM | `src/parse.ts:61-62` | bug | Multi-token / extra title tokens silently truncated to a single token | Either join tokens[2..-2] (all tokens between id and the trailing `{`) into the title, or emit a diagnostic when there are unexpected extra tokens before `{` so the truncation is not silent. |
| MEDIUM | `src/parse.ts:56-60` | bug | `claim {` (missing id) creates a claim whose id is the literal brace, no diagnostic | Before reading id, handle the case where tokens[1] === "{": that means there is no id, so emit CLAIM_ID. e.g. `if (!id || id === "{") { push CLAIM_ID; continue; }`. |
| MEDIUM | `src/parse.ts:33-45` | bug | Closing brace with trailing tokens (`} extra`) is not treated as a close; block/claim never closes | Detect a leading `}` token even when other tokens follow on the line, close the current block/claim, and emit a diagnostic about the trailing tokens, rather than misclassifying `}` as a block entry. |
| MEDIUM | `src/parse.ts:270` | robustness | Tokenizer does not split braces glued to adjacent non-space characters | Make `{` and `}` always split out of adjacent runs, e.g. tokenize by alternating quoted-string / brace / non-brace-non-space runs, or post-split bare tokens on brace boundaries. The current ordering relies on whitespace separation that the grammar does not require. |
| MEDIUM | `src/parse.ts:132-137` | spec-mismatch | Parser emits top-level `source` field not present in SPEC's documented JSON Output Shape | Either add `source` to the documented JSON Output Shape in SPEC.md (and note it is optional/present when a filename is supplied), or omit it from the emitted document. Pick one so the documented contract and emitter agree. |
| MEDIUM | `src/parse.ts:56-62` | spec-mismatch | Claim `id` pattern from schema/SPEC is never enforced by the parser | Validate `id` against the schema pattern at parse time (emit an error diagnostic like CLAIM_ID_INVALID) or at least in check.ts, so emitted claims always satisfy ablesyn-claim.schema.json. |
| MEDIUM | `src/translate.ts:21, 44` | spec-mismatch | belief.notes (confidence-is-stance caveats) dropped from rendering | Append notes to the Belief line, e.g. `; notes ${joinOrNone(claim.belief.notes)}` (and `; 备注` in zh). |
| MEDIUM | `src/translate.ts:1-77` | test-gap | translate.ts is entirely untested despite a dedicated SPEC section | Add tests that translate the bundled examples to en and zh and assert verdict status, confidence (e.g. 'confidence 0.58'), and the 'not evidence true/不作证据' line appear; cover the no-frame branch too. |
| MEDIUM | `tests/parse.test.ts:1-36` | test-gap | No tests for parser error/diagnostic paths or malformed input | Add fixtures (or inline strings) for: unclosed block, unmatched close brace, nested claim, claim missing id, line outside a claim, unknown block name. Assert the specific diagnostic codes. |
| LOW | `src/check.ts:18-29` | test-gap | Layer/verdict invariants checked but layer-specific verdict rules and EVIDENCE/NARRATIVE constraints absent | If cross-layer leakage is intended to be enforced, add a heuristic (e.g. NARRATIVE/BEHAVIOR claims that reach SUBSTRATE conclusions without substrate evidence). Otherwise document explicitly that SPEC line 32 is advisory and unchecked in v0. |
| LOW | `src/cli.ts:20,56-62` | robustness | --json flag is silently accepted and ignored for translate and check commands | Either reject unknown/unsupported flags per command (recommended: maintain a per-command allowed-flag set and error on others) or at minimum warn when a recognized flag has no effect for the chosen command. |
| LOW | `src/parse.ts:273-282` | robustness | unquote does not validate or unescape `\t`/other escapes and silently leaves unterminated quotes raw | Process escapes in a single left-to-right scan rather than chained .replace() to avoid order-dependent collisions, and emit a diagnostic for a token that opens with `"` but is not a well-formed closed quoted string. |
| LOW | `src/parse.ts:147-148` | clarity | Bare-token value joining can fuse intended-separate tokens without warning | Consider warning when an entry that the spec types as `string` receives multiple bare tokens instead of a single quoted string, so accidental missing quotes are surfaced. |
| LOW | `src/parse.ts:102-104` | spec-mismatch | `layer` value is cast without validation; non-enum layers flow into emitted JSON | Validate the layer token against the four allowed values in the parser and push an error diagnostic when it is not one of them, mirroring check.ts's INVALID_LAYER, so parse output is self-consistent with the schema. |
| LOW | `src/parse.ts:107-115` | spec-mismatch | Parser accepts a bare `verdict STATUS` line form the grammar sketch does not describe | Either document the line form (and the zero-reason allowance) in the grammar sketch, or restrict the parser to the documented block form. |
| LOW | `src/parse.ts:154-199` | spec-mismatch | Empty affordance/probe/verdict blocks accepted despite grammar's `+` (one-or-more) requirement | If the `+` semantics are intended, emit a diagnostic for empty affordance/probe/verdict blocks; otherwise relax the grammar sketch to `*` to match the implementation. |
| LOW | `src/parse.ts:61-62` | test-gap | Claim title parsing is fragile and untested for the no-title case | Add a parse test for `claim foo { layer NARRATIVE ... }` asserting title is undefined and id is 'foo', covering the untitled branch. |
| LOW | `src/translate.ts:32, 55` | robustness | not_evidence renders literal 'false' when unspecified, implying frame quote is usable as evidence | Distinguish unset from explicit false, e.g. render 'unspecified' (or default the human-facing wording to the safer 'not evidence' framing) when claim.frame.not_evidence === undefined. |
| LOW | `src/types.ts:1-3` | robustness | Schema enums duplicate TS literal unions with no shared source, inviting drift | Generate the JSON Schemas from the TS types (e.g. ts-json-schema-generator / typescript-json-schema) or add a test that asserts each schema enum equals the corresponding TS union, so enum drift fails CI. |
| LOW | `tests/parse.test.ts:29-36` | robustness | SELF_REPORT_IS_NOT_AUTHORITY test does not pin the verdict-status guard | Add a fixture: SUBSTRATE PASS with `observed self_report` AND `external runtime_attestation` and assert SELF_REPORT_IS_NOT_AUTHORITY does NOT fire; optionally a self-report SUBSTRATE FLAG that is allowed. |

## 附录：contested 发现

| 位置 | 类别 | 问题 | 修复建议 |
|---|---|---|---|
| `src/translate.ts:23, 46` | spec-mismatch | Evidence kinds (missing/inferred) not surfaced distinctly — flattened into one list | Group or label by kind, e.g. surface a distinct 'Missing evidence:' / 'Inferred:' segment, or at minimum sort so missing/inferred entries are not buried among observed ones. Consider an explicit 'none observed' note when only missing/inferred kinds exist. |
