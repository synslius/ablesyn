import { defineConfig } from "tsup";
import { readFile, writeFile } from "node:fs/promises";

const SHEBANG = "#!/usr/bin/env node\n";

export default defineConfig({
  // Two entries: `index` is the importable library surface, `cli` is the bin.
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  clean: true,
  dts: true,
  // NO global banner: a global banner injects the shebang into every output,
  // which corrupts dist/index.js as an importable module. The shebang is scoped
  // to the cli entry only, in a per-build post step below.
  async onSuccess() {
    const cliPath = "dist/cli.js";
    const body = await readFile(cliPath, "utf8");
    if (!body.startsWith(SHEBANG)) {
      await writeFile(cliPath, SHEBANG + body);
    }
  },
});
