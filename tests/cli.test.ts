import { expect, test } from "bun:test";

async function runCli(args: string[]): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(["bun", "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);
  return { code, out: stdout + stderr };
}

test("check keeps processing remaining files after an unreadable one", async () => {
  const { code, out } = await runCli([
    "check",
    "examples/hello.able",
    "tests/fixtures/does-not-exist.able",
    "examples/capability-claim.able"
  ]);

  // both readable files were still processed despite the missing file in between
  expect(out).toContain("examples/hello.able:");
  expect(out).toContain("examples/capability-claim.able:");
  // the missing file is reported as an error, not crashed on
  expect(out).toMatch(/does-not-exist\.able.*(ERROR|cannot read)/i);
  // a failure means a non-zero exit code
  expect(code).not.toBe(0);
});

test("check does not label a BLOCK-verdict document as PASS", async () => {
  // self-verification.able is lint-clean, but its claim verdict is BLOCK
  const { out } = await runCli(["check", "examples/self-verification.able"]);

  expect(out).toContain("examples/self-verification.able: OK");
  expect(out).not.toContain("PASS");
});
