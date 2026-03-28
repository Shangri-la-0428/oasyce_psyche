// ============================================================
// Update manager — context-aware update checks and explicit upgrades
//
// Goals:
// - Never block agent startup
// - Never mutate a dirty local git worktree behind the user's back
// - Give the right update instruction for the current install shape
// - Allow explicit self-update via CLI when safe
// ============================================================

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PACKAGE_NAME = "psyche-ai";
const FALLBACK_VERSION = "0.0.0";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_DIR = join(homedir(), ".psyche-ai");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const FETCH_TIMEOUT_MS = 5000;
const APPLY_TIMEOUT_MS = 30_000;
const BUILD_TIMEOUT_MS = 60_000;

interface PackageMetadata {
  root: string;
  version: string;
}

interface UpdateCache {
  lastCheck: number;
  latestVersion: string | null;
}

export type InstallMode = "npm-project" | "git-worktree" | "local-path";

export interface InstallContext {
  mode: InstallMode;
  packageRoot: string;
  updateCwd: string;
  manualCommand: string;
  autoApplyOnInit: boolean;
  requiresRestart: boolean;
  hasBuildScript: boolean;
  gitBranch?: string | null;
  gitUpstream?: string | null;
  dirty?: boolean;
  reason?: string;
}

export interface SelfUpdateResult {
  status: "up-to-date" | "updated" | "available" | "skipped" | "failed";
  currentVersion: string;
  latestVersion: string | null;
  context: InstallContext;
  manualCommand: string;
  message: string;
  restartRequired: boolean;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function readPackageMetadata(root: string): Promise<{ version: string; hasBuildScript: boolean }> {
  const raw = await readFile(join(root, "package.json"), "utf-8");
  const pkg = JSON.parse(raw) as { version?: string; scripts?: Record<string, string> };
  return {
    version: pkg.version ?? FALLBACK_VERSION,
    hasBuildScript: typeof pkg.scripts?.build === "string" && pkg.scripts.build.length > 0,
  };
}

async function resolvePackageMetadata(): Promise<PackageMetadata> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(__dirname, ".."),
    join(__dirname, "..", ".."),
  ];

  for (const root of candidates) {
    try {
      const meta = await readPackageMetadata(root);
      return { root, version: meta.version };
    } catch {
      // Try next candidate.
    }
  }

  return { root: process.cwd(), version: process.env.npm_package_version ?? FALLBACK_VERSION };
}

let packageMetadataPromise: Promise<PackageMetadata> | null = null;

async function getPackageMetadata(): Promise<PackageMetadata> {
  packageMetadataPromise ??= resolvePackageMetadata();
  return packageMetadataPromise;
}

export function getPackageVersion(): Promise<string> {
  return getPackageMetadata().then((meta) => meta.version);
}

function compareSemverPart(a: string | undefined, b: string | undefined): number {
  const na = Number(a ?? 0);
  const nb = Number(b ?? 0);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < 3; i++) {
    const cmp = compareSemverPart(pa[i], pb[i]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    const data = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(data) as UpdateCache;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache), "utf-8");
  } catch {
    // Silent — cache is optional.
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(
      `https://registry.npmjs.org/${PACKAGE_NAME}/latest`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(
  file: string,
  args: string[],
  cwd: string,
  timeout: number,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      timeout,
    });
    return { ok: true, stdout, stderr };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

async function detectGitContext(packageRoot: string, hasBuildScript: boolean): Promise<InstallContext | null> {
  const topLevel = await runCommand("git", ["rev-parse", "--show-toplevel"], packageRoot, 5000);
  if (!topLevel.ok) return null;

  const repoRoot = topLevel.stdout.trim();
  if (!repoRoot) return null;

  const branchResult = await runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], repoRoot, 5000);
  const branch = branchResult.ok ? branchResult.stdout.trim() : null;

  const upstreamResult = await runCommand(
    "git",
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    repoRoot,
    5000,
  );
  const upstream = upstreamResult.ok ? upstreamResult.stdout.trim() : null;

  const dirtyResult = await runCommand("git", ["status", "--porcelain"], repoRoot, 5000);
  const dirty = dirtyResult.ok ? dirtyResult.stdout.trim().length > 0 : true;

  const buildStep = hasBuildScript ? " && npm run build" : "";
  const manualCommand = `cd ${shellQuote(repoRoot)} && git pull --ff-only${buildStep}`;

  return {
    mode: "git-worktree",
    packageRoot,
    updateCwd: repoRoot,
    manualCommand,
    autoApplyOnInit: false,
    requiresRestart: true,
    hasBuildScript,
    gitBranch: branch,
    gitUpstream: upstream,
    dirty,
    reason: dirty
      ? "working tree has local changes"
      : upstream
        ? undefined
        : "git branch has no tracked upstream",
  };
}

export async function detectInstallContext(packageRootArg?: string): Promise<InstallContext> {
  const packageRoot = resolve(packageRootArg ?? (await getPackageMetadata()).root);
  const { hasBuildScript } = await readPackageMetadata(packageRoot).catch(() => ({
    version: FALLBACK_VERSION,
    hasBuildScript: false,
  }));

  const gitContext = await detectGitContext(packageRoot, hasBuildScript);
  if (gitContext) return gitContext;

  const marker = `${sep}node_modules${sep}${PACKAGE_NAME}`;
  const idx = packageRoot.lastIndexOf(marker);
  if (idx >= 0) {
    const projectRoot = packageRoot.slice(0, idx) || sep;
    return {
      mode: "npm-project",
      packageRoot,
      updateCwd: projectRoot,
      manualCommand: `cd ${shellQuote(projectRoot)} && npm update ${PACKAGE_NAME}`,
      autoApplyOnInit: true,
      requiresRestart: true,
      hasBuildScript,
    };
  }

  const localBuildStep = hasBuildScript && await pathExists(join(packageRoot, "tsconfig.json"))
    ? " && npm run build"
    : "";
  return {
    mode: "local-path",
    packageRoot,
    updateCwd: packageRoot,
    manualCommand: `cd ${shellQuote(packageRoot)} && npm update ${PACKAGE_NAME}${localBuildStep}`,
    autoApplyOnInit: false,
    requiresRestart: true,
    hasBuildScript,
    reason: "local path install is not package-manager managed",
  };
}

function formatAvailableMessage(
  latestVersion: string,
  currentVersion: string,
  context: InstallContext,
): string {
  return `[psyche-ai] v${latestVersion} available (current: v${currentVersion}). Run: psyche upgrade` +
    (context.mode === "git-worktree" || context.mode === "local-path"
      ? ` or ${context.manualCommand}`
      : "");
}

async function applyNpmProjectUpdate(context: InstallContext, latestVersion: string): Promise<SelfUpdateResult> {
  const result = await runCommand(
    "npm",
    ["update", PACKAGE_NAME, "--registry", "https://registry.npmjs.org"],
    context.updateCwd,
    APPLY_TIMEOUT_MS,
  );

  if (!result.ok) {
    return {
      status: "failed",
      currentVersion: await getPackageVersion(),
      latestVersion,
      context,
      manualCommand: context.manualCommand,
      message: `[psyche-ai] Auto-update failed. Run manually: ${context.manualCommand}`,
      restartRequired: false,
    };
  }

  const nextVersion = await readPackageMetadata(context.packageRoot)
    .then((meta) => meta.version)
    .catch(() => latestVersion);

  return {
    status: "updated",
    currentVersion: nextVersion,
    latestVersion,
    context,
    manualCommand: context.manualCommand,
    message: `[psyche-ai] Updated to v${nextVersion}. Restart hosts using it to load the new build.`,
    restartRequired: true,
  };
}

async function applyGitWorktreeUpdate(context: InstallContext, latestVersion: string): Promise<SelfUpdateResult> {
  const currentVersion = await getPackageVersion();

  if (context.dirty) {
    return {
      status: "skipped",
      currentVersion,
      latestVersion,
      context,
      manualCommand: context.manualCommand,
      message: `[psyche-ai] Skipped self-update: ${context.reason}. Run manually: ${context.manualCommand}`,
      restartRequired: false,
    };
  }

  if (!context.gitUpstream) {
    return {
      status: "skipped",
      currentVersion,
      latestVersion,
      context,
      manualCommand: context.manualCommand,
      message: `[psyche-ai] Skipped self-update: ${context.reason}. Run manually: ${context.manualCommand}`,
      restartRequired: false,
    };
  }

  const pullResult = await runCommand("git", ["pull", "--ff-only"], context.updateCwd, APPLY_TIMEOUT_MS);
  if (!pullResult.ok) {
    return {
      status: "failed",
      currentVersion,
      latestVersion,
      context,
      manualCommand: context.manualCommand,
      message: `[psyche-ai] Git update failed. Run manually: ${context.manualCommand}`,
      restartRequired: false,
    };
  }

  if (context.hasBuildScript) {
    const buildResult = await runCommand("npm", ["run", "build"], context.packageRoot, BUILD_TIMEOUT_MS);
    if (!buildResult.ok) {
      return {
        status: "failed",
        currentVersion,
        latestVersion,
        context,
        manualCommand: context.manualCommand,
        message: `[psyche-ai] Pulled latest code but build failed. Run manually: ${context.manualCommand}`,
        restartRequired: false,
      };
    }
  }

  const nextVersion = await readPackageMetadata(context.packageRoot)
    .then((meta) => meta.version)
    .catch(() => latestVersion);

  return {
    status: "updated",
    currentVersion: nextVersion,
    latestVersion,
    context,
    manualCommand: context.manualCommand,
    message: `[psyche-ai] Updated worktree to v${nextVersion}. Restart hosts using it to load the new build.`,
    restartRequired: true,
  };
}

async function applyExplicitUpdate(context: InstallContext, latestVersion: string): Promise<SelfUpdateResult> {
  switch (context.mode) {
    case "npm-project":
      return applyNpmProjectUpdate(context, latestVersion);
    case "git-worktree":
      return applyGitWorktreeUpdate(context, latestVersion);
    case "local-path":
      return {
        status: "skipped",
        currentVersion: await getPackageVersion(),
        latestVersion,
        context,
        manualCommand: context.manualCommand,
        message: `[psyche-ai] This install shape needs a manual update. Run: ${context.manualCommand}`,
        restartRequired: false,
      };
  }
}

export async function selfUpdate(opts?: {
  checkOnly?: boolean;
  packageRoot?: string;
  latestVersion?: string | null;
}): Promise<SelfUpdateResult> {
  const currentVersion = opts?.packageRoot
    ? await readPackageMetadata(resolve(opts.packageRoot)).then((meta) => meta.version)
    : await getPackageVersion();
  const context = await detectInstallContext(opts?.packageRoot);
  const latestVersion = opts?.latestVersion ?? await fetchLatestVersion();

  if (!latestVersion) {
    return {
      status: "failed",
      currentVersion,
      latestVersion: null,
      context,
      manualCommand: context.manualCommand,
      message: "[psyche-ai] Could not reach the registry to check for updates.",
      restartRequired: false,
    };
  }

  if (compareSemver(currentVersion, latestVersion) >= 0) {
    return {
      status: "up-to-date",
      currentVersion,
      latestVersion,
      context,
      manualCommand: context.manualCommand,
      message: `[psyche-ai] v${currentVersion} is up to date.`,
      restartRequired: false,
    };
  }

  if (opts?.checkOnly) {
    return {
      status: "available",
      currentVersion,
      latestVersion,
      context,
      manualCommand: context.manualCommand,
      message: formatAvailableMessage(latestVersion, currentVersion, context),
      restartRequired: false,
    };
  }

  return applyExplicitUpdate(context, latestVersion);
}

/**
 * Check for updates. Non-blocking, safe to fire-and-forget.
 * - Checks at most once per hour (cached)
 * - Auto-applies only for npm-managed installs
 * - For git/local-path installs, prints the correct explicit upgrade command
 * - Never throws
 */
export async function checkForUpdate(): Promise<void> {
  const currentVersion = await getPackageVersion();
  const context = await detectInstallContext();

  const cache = await readCache();
  if (cache && Date.now() - cache.lastCheck < CHECK_INTERVAL_MS) {
    if (cache.latestVersion && compareSemver(currentVersion, cache.latestVersion) < 0) {
      console.log(formatAvailableMessage(cache.latestVersion, currentVersion, context));
    }
    return;
  }

  const latestVersion = await fetchLatestVersion();
  await writeCache({ lastCheck: Date.now(), latestVersion });

  if (!latestVersion || compareSemver(currentVersion, latestVersion) >= 0) {
    return;
  }

  if (!context.autoApplyOnInit) {
    console.log(formatAvailableMessage(latestVersion, currentVersion, context));
    return;
  }

  console.log(`[psyche-ai] New version v${latestVersion} available (current: v${currentVersion}), updating...`);
  const result = await applyExplicitUpdate(context, latestVersion);
  console.log(result.message);
}
