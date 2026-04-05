import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const exec = promisify(execFile);
const ROOT = join(import.meta.dirname, "..", "..");

describe("mcp module boundary", () => {
  it("importing the MCP module does not auto-start stdio", { timeout: 15000 }, async () => {
    const modulePath = join(ROOT, "dist", "adapters", "mcp.js");
    const script = `
      import(${JSON.stringify(`file://${modulePath}`)})
        .then(() => console.log("loaded"))
        .catch((error) => {
          console.error(error);
          process.exit(1);
        });
    `;
    const { stdout, stderr } = await exec(process.execPath, ["--input-type=module", "-e", script], {
      cwd: ROOT,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(stdout.trim(), "loaded");
    assert.equal(stderr.trim(), "");
  });
});
