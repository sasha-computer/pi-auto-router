/**
 * Auto model router — classifies each prompt with Haiku and routes to Sonnet or Opus.
 *
 * No more manual model switching. You type a prompt, Haiku decides if it needs
 * Sonnet (most tasks) or Opus (complex architecture, subtle debugging, multi-file
 * refactors), and the model is switched before the agent runs.
 *
 * Hooks used:
 * - input: intercepts the prompt, calls Haiku to classify, switches model
 * - model_select: tracks manual overrides
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

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
		if (!haiku) return;

		const apiKey = await ctx.modelRegistry.getApiKey(haiku);
		if (!apiKey) return;

		try {
			ctx.ui.setStatus("router", "routing…");

			const response = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-api-key": apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: HAIKU_ID,
					max_tokens: 16,
					messages: [{ role: "user", content: prompt }],
					system: CLASSIFY_PROMPT,
				}),
			});

			if (!response.ok) {
				ctx.ui.setStatus("router", undefined);
				return;
			}

			const data = (await response.json()) as {
				content: Array<{ type: string; text: string }>;
			};
			const answer = data.content?.[0]?.text?.trim().toLowerCase() ?? "";

			let targetId: string;
			if (answer.includes("opus")) {
				targetId = OPUS_ID;
			} else {
				// Default to sonnet for anything unclear
				targetId = SONNET_ID;
			}

			// Only switch if we're not already on the target
			const currentId = ctx.model?.id;
			if (currentId !== targetId) {
				const targetModel = ctx.modelRegistry.find("anthropic", targetId);
				if (targetModel) {
					const success = await pi.setModel(targetModel);
					if (success) {
						lastRouted = targetId;
						ctx.ui.setStatus(
							"router",
							`→ ${targetId.includes("opus") ? "opus" : "sonnet"}`
						);
					} else {
						ctx.ui.setStatus("router", undefined);
					}
				}
			} else {
				lastRouted = targetId;
				ctx.ui.setStatus(
					"router",
					`→ ${targetId.includes("opus") ? "opus" : "sonnet"}`
				);
			}
		} catch (e) {
			// Classification failed — just use whatever model is active
			ctx.ui.setStatus("router", undefined);
		}
	});
}
