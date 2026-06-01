import { expect, test } from "bun:test";
import { parseAble } from "../src/parse.ts";
import { translateDocument } from "../src/translate.ts";

test("English translation preserves frame effects and contextual limits", async () => {
  const source = await Bun.file("tests/fixtures/translation-frame-effects-contextual.able").text();
  const document = parseAble(source, "tests/fixtures/translation-frame-effects-contextual.able");
  const rendered = translateDocument(document, "en");

  expect(rendered).toContain("effects raise_exploration_budget:moderate");
  expect(rendered).toContain("not_evidence true");
  expect(rendered).toContain("contextual local_repo_state_only");
  expect(rendered).toContain("observed side_door_found/one alternate route exists");
  expect(rendered).toContain("missing regression_test");
});

test("Chinese translation preserves contract words for frame effects and contextual limits", async () => {
  const source = await Bun.file("tests/fixtures/translation-frame-effects-contextual.able").text();
  const document = parseAble(source, "tests/fixtures/translation-frame-effects-contextual.able");
  const rendered = translateDocument(document, "zh");

  expect(rendered).toContain("effects raise_exploration_budget:moderate");
  expect(rendered).toContain("not_evidence true");
  expect(rendered).toContain("contextual local_repo_state_only");
  expect(rendered).toContain("observed side_door_found/one alternate route exists");
  expect(rendered).toContain("missing regression_test");
});
