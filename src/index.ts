// ============================================================
// openclaw-plugin-psyche — Artificial Psyche Plugin (v0.2)
//
// Plug-and-play emotional intelligence for OpenClaw agents.
// Provides: Virtual Endocrine System, Empathy Engine, Agency.
// ============================================================

import type { PsycheConfig, PsycheState, StimulusType, Locale } from "./types.js";
import {
  loadState, saveState, decayAndSave, parsePsycheUpdate,
  mergeUpdates, updateAgreementStreak, getRelationship, pushSnapshot,
} from "./psyche-file.js";
import type { Logger } from "./psyche-file.js";
import { buildDynamicContext, buildProtocolContext } from "./prompt.js";
import { applyContagion, applyStimulus } from "./chemistry.js";
import { getSensitivity } from "./profiles.js";
import { isStimulusType } from "./guards.js";
import { classifyStimulus } from "./classify.js";

// ── Plugin API Types ─────────────────────────────────────────

interface PluginApi {
  pluginConfig?: Record<string, unknown>;
  logger: Logger;
  on(
    event: string,
    handler: (event: HookEvent, ctx: HookContext) => Promise<Record<string, unknown> | void>,
    opts?: { priority: number },
  ): void;
  registerCli?(
    handler: (cli: CliRegistrar) => void,
    opts: { commands: string[] },
  ): void;
}

interface HookEvent {
  text?: string;
  content?: string;
}

interface HookContext {
  workspaceDir?: string;
  userId?: string;
}

interface CliCommand {
  description(desc: string): CliCommand;
  argument(name: string, desc: string, defaultValue?: string): CliCommand;
  action(fn: (arg: string) => Promise<void>): void;
}

interface CliRegistrar {
  command(name: string): CliCommand;
}

// ── Internals ────────────────────────────────────────────────

// In-memory state cache to avoid repeated file reads within a session
const stateCache = new Map<string, PsycheState>();

/**
 * Resolve plugin config with defaults.
 */
function resolveConfig(raw?: Record<string, unknown>): PsycheConfig {
  return {
    enabled: (raw?.enabled as boolean) ?? true,
    stripUpdateTags: (raw?.stripUpdateTags as boolean) ?? true,
    emotionalContagionRate: (raw?.emotionalContagionRate as number) ?? 0.2,
    maxChemicalDelta: (raw?.maxChemicalDelta as number) ?? 25,
  };
}

/**
 * Get or load state for a workspace, applying decay.
 */
async function getState(workspaceDir: string, logger: Logger): Promise<PsycheState> {
  let state = stateCache.get(workspaceDir);

  if (!state) {
    state = await loadState(workspaceDir, logger);
  }

  // Apply time decay
  state = await decayAndSave(workspaceDir, state);
  stateCache.set(workspaceDir, state);

  return state;
}

// ── Plugin Definition ────────────────────────────────────────

const plugin = {
  id: "psyche",
  name: "Artificial Psyche",
  description: "Virtual endocrine system, empathy engine, and agency for OpenClaw agents",
  version: "0.2.0",

  register(api: PluginApi) {
    const config = resolveConfig(api.pluginConfig);
    const logger = api.logger;

    if (!config.enabled) {
      logger.info("Psyche plugin disabled by config");
      return;
    }

    logger.info("Psyche plugin activating — emotional intelligence online");

    // Cache protocol prompt per locale
    const protocolCache = new Map<Locale, string>();
    function getProtocol(locale: Locale): string {
      let p = protocolCache.get(locale);
      if (!p) {
        p = buildProtocolContext(locale);
        protocolCache.set(locale, p);
      }
      return p;
    }

    // ── Hook 1: Classify user input & inject emotional context ──

    api.on("before_prompt_build", async (event: HookEvent, ctx: HookContext) => {
      const workspaceDir = ctx?.workspaceDir;
      if (!workspaceDir) return {};

      try {
        let state = await getState(workspaceDir, logger);
        const locale = state.meta.locale ?? "zh";
        const userText = event?.text ?? "";

        // Direction 1: Pre-classify user stimulus and apply chemistry
        let appliedStimulus: StimulusType | null = null;
        if (userText.length > 0) {
          const classifications = classifyStimulus(userText);
          const primary = classifications[0];
          if (primary && primary.confidence >= 0.5) {
            appliedStimulus = primary.type;
            const sensitivity = getSensitivity(state.mbti);
            state = {
              ...state,
              current: applyStimulus(
                state.current,
                primary.type,
                sensitivity,
                config.maxChemicalDelta,
                logger,
              ),
            };
            logger.debug(
              `Psyche: classified "${userText.slice(0, 30)}..." as ${primary.type} ` +
              `(confidence: ${primary.confidence.toFixed(2)})`,
            );
          }
        }

        // Direction 2: Push snapshot to emotional history
        state = pushSnapshot(state, appliedStimulus);

        // Persist pre-computed state
        stateCache.set(workspaceDir, state);
        await saveState(workspaceDir, state);

        const dynamicContext = buildDynamicContext(state, ctx.userId);

        return {
          appendSystemContext: getProtocol(locale),
          prependContext: dynamicContext,
        };
      } catch (err) {
        logger.warn(`Psyche: failed to build context for ${workspaceDir}: ${err}`);
        return {};
      }
    }, { priority: 10 });

    // ── Hook 2: Parse psyche_update from LLM output ──────────

    api.on("llm_output", async (event: HookEvent, ctx: HookContext) => {
      const workspaceDir = ctx?.workspaceDir;
      if (!workspaceDir) return;

      const text = event?.text ?? event?.content ?? "";
      if (!text) return;

      try {
        let state = stateCache.get(workspaceDir) ?? await loadState(workspaceDir, logger);

        // Emotional contagion: if empathy log detected user emotion
        if (state.empathyLog?.userState && config.emotionalContagionRate > 0) {
          const userEmotion = state.empathyLog.userState.toLowerCase();
          if (isStimulusType(userEmotion)) {
            const sensitivity = 1.0; // TODO: get from profile
            state = {
              ...state,
              current: applyContagion(
                state.current,
                userEmotion as StimulusType,
                config.emotionalContagionRate,
                sensitivity,
              ),
            };
          }
        }

        // Anti-sycophancy: update agreement streak
        state = updateAgreementStreak(state, text);

        // Parse psyche_update if present
        if (text.includes("<psyche_update>")) {
          const updates = parsePsycheUpdate(text, logger);
          if (updates) {
            state = mergeUpdates(state, updates, config.maxChemicalDelta, ctx.userId);
          }
        }

        stateCache.set(workspaceDir, state);
        await saveState(workspaceDir, state);

        logger.info(
          `Psyche: state updated for ${state.meta.agentName} ` +
          `(interactions: ${state.meta.totalInteractions}, ` +
          `agreementStreak: ${state.agreementStreak})`,
        );
      } catch (err) {
        logger.warn(`Psyche: failed to process output: ${err}`);
      }
    }, { priority: 50 });

    // ── Hook 3: Strip <psyche_update> from visible output ────

    if (config.stripUpdateTags) {
      api.on("message_sending", async (event: HookEvent, _ctx: HookContext) => {
        const content = event?.content;
        if (typeof content !== "string") return {};
        if (!content.includes("<psyche_update>")) return {};

        const cleaned = content
          .replace(/<psyche_update>[\s\S]*?<\/psyche_update>/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        return { content: cleaned };
      }, { priority: 90 });
    }

    // ── Hook 4: Save state on session end ────────────────────

    api.on("agent_end", async (_event: HookEvent, ctx: HookContext) => {
      const workspaceDir = ctx?.workspaceDir;
      if (!workspaceDir) return;

      const state = stateCache.get(workspaceDir);
      if (state) {
        await saveState(workspaceDir, state);
        logger.info(
          `Psyche: session ended for ${state.meta.agentName}, ` +
          `chemistry saved (DA:${Math.round(state.current.DA)} ` +
          `HT:${Math.round(state.current.HT)} ` +
          `CORT:${Math.round(state.current.CORT)} ` +
          `OT:${Math.round(state.current.OT)} ` +
          `NE:${Math.round(state.current.NE)} ` +
          `END:${Math.round(state.current.END)})`,
        );
      }
    }, { priority: 50 });

    // ── CLI: psyche status command ───────────────────────────

    api.registerCli?.((cli: CliRegistrar) => {
      cli.command("psyche")
        .description("Show current psyche state for an agent")
        .argument("[agent]", "Agent name", "main")
        .action(async (agent: string) => {
          console.log(`\nPsyche Status: ${agent}\n`);
          console.log("Use the agent's workspace to inspect psyche-state.json");
        });
    }, { commands: ["psyche"] });

    logger.info("Psyche plugin ready — 4 hooks registered");
  },
};

export default plugin;
