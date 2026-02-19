/**
 * Auto model router — classifies each prompt with Haiku and routes to Sonnet or Opus.
 *
 * No more manual model switching. You type a prompt, Haiku decides if it needs
 * Sonnet (most tasks) or Opus (complex architecture, subtle debugging, multi-file
 * refactors), and the model is switched before the agent runs.
 *
 * Hooks used:
 * - before_agent_start: classifies prompt with Haiku, switches model
 * - model_select: tracks manual overrides
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { completeSimple } from "@mariozechner/pi-ai";
import { quickClassify, parseRoutingDecision } from "../lib/auto-router-logic";

const SONNET_ID = "claude-sonnet-4-6";
const OPUS_ID = "claude-opus-4-6";
const HAIKU_ID = "claude-haiku-4-5";

const CLASSIFY_PROMPT = `You are a model router. Given a user's prompt to a coding assistant, decide which model should handle it.

Reply with ONLY one word: "sonnet" or "opus".

Use opus for:
- Complex architecture and system design
- Multi-file refactors with tricky interdependencies
- Subtle debugging (race conditions, memory leaks, flaky tests)
- Novel algorithm design
- Nuanced writing or deep analysis
- Tasks requiring long chains of reasoning

Use sonnet for everything else:
- File reads, lookups, status checks
- Simple to moderate code edits
- Running commands
- Straightforward questions
- Standard refactors
- Writing tests for existing code
- Most everyday coding tasks

When in doubt, pick sonnet. Only pick opus when the task genuinely needs deeper reasoning.`;

export default function (pi: ExtensionAPI) {
	let lastRouted: string | undefined;
	let manualOverride = false;
	let pinnedModel: string | undefined; // set by /opus, /sonnet, /haiku; cleared by /auto

	// Slash commands: /opus, /sonnet, /haiku, /auto
	pi.registerCommand("opus", {
		description: "Pin router to Opus for all turns. Use /auto to resume.",
		handler: async (_args, ctx) => {
			pinnedModel = OPUS_ID;
			const model = ctx.modelRegistry.find("anthropic", OPUS_ID);
			if (model) await pi.setModel(model);
			ctx.ui.setStatus("router", "📌 pinned → opus");
			ctx.ui.notify("Router pinned to Opus. Type /auto to resume auto-routing.", "info");
		},
	});

	pi.registerCommand("sonnet", {
		description: "Pin router to Sonnet for all turns. Use /auto to resume.",
		handler: async (_args, ctx) => {
			pinnedModel = SONNET_ID;
			const model = ctx.modelRegistry.find("anthropic", SONNET_ID);
			if (model) await pi.setModel(model);
			ctx.ui.setStatus("router", "📌 pinned → sonnet");
			ctx.ui.notify("Router pinned to Sonnet. Type /auto to resume auto-routing.", "info");
		},
	});

	pi.registerCommand("haiku", {
		description: "Pin router to Haiku for all turns. Use /auto to resume.",
		handler: async (_args, ctx) => {
			pinnedModel = HAIKU_ID;
			const model = ctx.modelRegistry.find("anthropic", HAIKU_ID);
			if (model) await pi.setModel(model);
			ctx.ui.setStatus("router", "📌 pinned → haiku");
			ctx.ui.notify("Router pinned to Haiku. Type /auto to resume auto-routing.", "info");
		},
	});

	pi.registerCommand("auto", {
		description: "Resume automatic model routing (Haiku classifies each prompt).",
		handler: async (_args, ctx) => {
			pinnedModel = undefined;
			ctx.ui.setStatus("router", "auto-routing resumed");
			ctx.ui.notify("Auto-routing resumed.", "info");
		},
	});

	// Track manual model changes (Ctrl+P, Ctrl+L) — respect them for one turn
	pi.on("model_select", async (event, ctx) => {
		if (event.source === "cycle" || event.source === "set") {
			manualOverride = true;
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		// Skip if user manually picked a model (one-turn override)
		if (manualOverride) {
			manualOverride = false;
			return;
		}

		// Skip if a model is pinned — just ensure we're on it
		if (pinnedModel) {
			const current = ctx.model?.id;
			if (current !== pinnedModel) {
				const model = ctx.modelRegistry.find("anthropic", pinnedModel);
				if (model) await pi.setModel(model);
			}
			const label = pinnedModel.includes("opus") ? "opus" : pinnedModel.includes("haiku") ? "haiku" : "sonnet";
			ctx.ui.setStatus("router", `📌 pinned → ${label}`);
			return;
		}

		const prompt = event.prompt;
		if (!prompt || prompt.trim().length === 0) return;

		// Find Haiku for classification
		const haiku = ctx.modelRegistry.find("anthropic", HAIKU_ID);
		if (!haiku) {
			ctx.ui.setStatus("router", "⚠ haiku not found");
			return;
		}

		const apiKey = await ctx.modelRegistry.getApiKey(haiku);
		if (!apiKey) {
			ctx.ui.setStatus("router", "⚠ no API key for haiku");
			return;
		}

		try {
			// Fast local heuristic -- avoids a Haiku call for obvious cases
			const fast = quickClassify(prompt);
			let decision: "sonnet" | "opus";
			let viaHaiku = false;

			if (fast !== "uncertain") {
				decision = fast;
			} else {
				ctx.ui.setStatus("router", "⇢ routing…");

				const result = await completeSimple(haiku, {
					systemPrompt: CLASSIFY_PROMPT,
					messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
				}, { maxTokens: 16, apiKey });

				const answer = result.content
					.filter((c): c is { type: "text"; text: string } => c.type === "text")
					.map((c) => c.text)
					.join("");

				decision = parseRoutingDecision(answer);
				viaHaiku = true;
			}

			const targetId = decision === "opus" ? OPUS_ID : SONNET_ID;
			const modelName = decision === "opus" ? "opus" : "sonnet";
			const label = viaHaiku ? `⇢ ${modelName} · haiku` : `⇢ ${modelName}`;

			const currentId = ctx.model?.id;

			if (currentId !== targetId) {
				const targetModel = ctx.modelRegistry.find("anthropic", targetId);
				if (!targetModel) {
					ctx.ui.setStatus("router", `⚠ model not found: ${targetId}`);
					return;
				}
				const success = await pi.setModel(targetModel);
				if (success) {
					lastRouted = targetId;
					ctx.ui.setStatus("router", label);
				} else {
					ctx.ui.setStatus("router", `⚠ setModel failed for ${targetId}`);
				}
			} else {
				lastRouted = targetId;
				ctx.ui.setStatus("router", label);
			}
		} catch (e) {
			ctx.ui.setStatus("router", `⚠ ${e instanceof Error ? e.message : String(e)}`);
		}
	});
}
