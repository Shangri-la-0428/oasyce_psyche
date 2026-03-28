import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { compareSemver, detectInstallContext, selfUpdate } from "../src/update.js";

const exec = promisify(execFile);

async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writePackageJson(
  dir: string,
  version: string,
  scripts?: Record<string, string>,
): Promise<void> {
  await writeFile(join(dir, "package.json"), JSON.stringify({
    name: "psyche-ai",
    version,
    scripts,
  }, null, 2));
}

describe("update manager", () => {
  it("compares semver triplets correctly", () => {
    assert.equal(compareSemver("9.2.3", "9.2.3"), 0);
    assert.equal(compareSemver("9.2.4", "9.2.3"), 1);
    assert.equal(compareSemver("9.1.9", "9.2.0"), -1);
  });

  it("detects npm-managed installs from node_modules path", async () => {
    const root = await tempDir("psyche-update-npm-");
    const appRoot = join(root, "app");
    const packageRoot = join(appRoot, "node_modules", "psyche-ai");
    await mkdir(packageRoot, { recursive: true });
    await writePackageJson(packageRoot, "1.0.0");

    const context = await detectInstallContext(packageRoot);
    assert.equal(context.mode, "npm-project");
    assert.equal(context.updateCwd, appRoot);
    assert.equal(context.autoApplyOnInit, true);
    assert.ok(context.manualCommand.includes("npm update psyche-ai"));

    await rm(root, { recursive: true, force: true });
  });

  it("detects git worktrees and avoids auto-apply on init", async () => {
    const repo = await tempDir("psyche-update-git-");
    await writePackageJson(repo, "1.0.0", { build: "echo ok" });
    await exec("git", ["init"], { cwd: repo });

    const context = await detectInstallContext(repo);
    assert.equal(context.mode, "git-worktree");
    assert.equal(context.autoApplyOnInit, false);
    assert.equal(context.dirty, true);
    assert.ok(context.reason?.includes("working tree"));
    assert.ok(context.manualCommand.includes("git pull --ff-only"));
    assert.ok(context.manualCommand.includes("npm run build"));

    await rm(repo, { recursive: true, force: true });
  });

  it("reports dirty git worktrees as skipped in explicit upgrade", async () => {
    const repo = await tempDir("psyche-update-skip-");
    await writePackageJson(repo, "1.0.0");
    await exec("git", ["init"], { cwd: repo });

    const result = await selfUpdate({
      checkOnly: false,
      packageRoot: repo,
      latestVersion: "9.9.9",
    });
    assert.equal(result.status, "skipped");
    assert.ok(result.message.includes("Run manually"));

    await rm(repo, { recursive: true, force: true });
  });

  it("returns an available result in check-only mode without mutating", async () => {
    const packageRoot = await tempDir("psyche-update-check-");
    await writePackageJson(packageRoot, "1.0.0");

    const result = await selfUpdate({
      checkOnly: true,
      packageRoot,
      latestVersion: "9.9.9",
    });
    assert.equal(result.status, "available");
    assert.equal(result.latestVersion, "9.9.9");
    assert.ok(result.message.includes("psyche upgrade"));

    await rm(packageRoot, { recursive: true, force: true });
  });
});
