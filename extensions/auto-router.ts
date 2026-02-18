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

	// Track manual model changes (Ctrl+P, Ctrl+L) — respect them for one turn
	pi.on("model_select", async (event, ctx) => {
		if (event.source === "cycle" || event.source === "set") {
			manualOverride = true;
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		// Skip if user manually picked a model
		if (manualOverride) {
			manualOverride = false;
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
			ctx.ui.setStatus("router", "routing…");

			const result = await completeSimple(haiku, {
				systemPrompt: CLASSIFY_PROMPT,
				messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
			}, { maxTokens: 16, apiKey });

			const answer = result.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("")
				.trim()
				.toLowerCase();

			let targetId: string;
			if (answer.includes("opus")) {
				targetId = OPUS_ID;
			} else {
				targetId = SONNET_ID;
			}

			const currentId = ctx.model?.id;

			const label = targetId.includes("opus") ? "opus 4.6" : "sonnet 4.6";

			if (currentId !== targetId) {
				const targetModel = ctx.modelRegistry.find("anthropic", targetId);
				if (!targetModel) {
					ctx.ui.setStatus("router", `⚠ model not found: ${targetId}`);
					return;
				}
				const success = await pi.setModel(targetModel);
				if (success) {
					lastRouted = targetId;
					ctx.ui.setStatus("router", `→ ${label}`);
				} else {
					ctx.ui.setStatus("router", `⚠ setModel failed for ${targetId}`);
				}
			} else {
				lastRouted = targetId;
				ctx.ui.setStatus("router", `→ ${label}`);
			}
		} catch (e) {
			ctx.ui.setStatus("router", `⚠ ${e instanceof Error ? e.message : String(e)}`);
		}
	});
}
