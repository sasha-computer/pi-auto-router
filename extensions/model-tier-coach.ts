/**
 * Model tier coach - nudges when you're using the wrong model tier for the task.
 *
 * Inspired by @JordanLyall's tweet: "Call out when I'm using the wrong model tier.
 * Lookups on Opus = waste. Architecture on Sonnet = underpowered. Quick nudge, not a lecture."
 *
 * Hooks used:
 * - before_agent_start: injects tier-awareness into the system prompt
 * - model_select: tracks the current model tier for the status bar
 *
 * The extension categorizes models into tiers (premium/standard/budget) based on
 * their ID and cost, then adds a one-line system prompt instruction telling the
 * model to flag mismatches between task complexity and model tier.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type Tier = "premium" | "standard" | "budget";

interface TierInfo {
	tier: Tier;
	label: string;
	costNote: string;
}

/**
 * Classify a model into a cost tier based on its ID.
 */
function classifyModel(modelId: string): TierInfo {
	const id = modelId.toLowerCase();

	// Premium tier: Opus, o1, o3, GPT-4.5, deepseek-r1
	if (
		id.includes("opus") ||
		id.includes("o1-pro") ||
		id.includes("o3-pro") ||
		id.includes("gpt-4.5") ||
		(id.includes("o1") && !id.includes("o1-mini")) ||
		(id.includes("o3") && !id.includes("o3-mini"))
	) {
		return { tier: "premium", label: "Premium", costNote: "highest cost tier" };
	}

	// Budget tier: Haiku, mini models, Flash, GPT-4o-mini
	if (
		id.includes("haiku") ||
		id.includes("mini") ||
		id.includes("flash") ||
		id.includes("gpt-4o-mini") ||
		id.includes("gemma")
	) {
		return { tier: "budget", label: "Budget", costNote: "lowest cost tier" };
	}

	// Standard tier: Sonnet, GPT-4o, Gemini Pro, etc.
	return { tier: "standard", label: "Standard", costNote: "mid cost tier" };
}

const TIER_PROMPTS: Record<Tier, string> = {
	premium: `You are running on a PREMIUM (most expensive) model. If the user's request is simple — file reads, status checks, lookups, small edits, straightforward questions — give a brief one-line nudge at the END of your response suggesting they could switch to a cheaper model for this kind of task. Use a casual tone, e.g. "Heads up: this is a Sonnet-tier task, you could save tokens by switching down." Don't lecture, don't repeat the nudge if you already gave one recently, and never let it interfere with doing the actual work first.`,

	standard: `You are running on a STANDARD (mid-tier) model. If the user's request involves genuinely complex work — large-scale architecture, multi-file refactors with tricky interdependencies, novel algorithm design, deep debugging of subtle issues — give a brief one-line nudge at the END of your response suggesting they might benefit from a more capable model for this specific task. Be conservative: most tasks are fine on this tier. Only nudge for truly hard stuff.`,

	budget: `You are running on a BUDGET (cheapest) model. If the user's request is clearly too complex for this tier — architecture decisions, complex refactors, subtle debugging, multi-step reasoning — give a brief one-line nudge at the END of your response suggesting they switch up for this task. For simple lookups, reads, and small edits, this tier is perfect — no nudge needed.`,
};

export default function (pi: ExtensionAPI) {
	let currentTier: TierInfo | null = null;

	// Track model changes for status display
	pi.on("model_select", async (event, ctx) => {
		currentTier = classifyModel(event.model.id);
	});

	// Inject tier-awareness into the system prompt before each agent run
	pi.on("before_agent_start", async (event, ctx) => {
		if (!ctx.model) return;

		const tierInfo = classifyModel(ctx.model.id);
		currentTier = tierInfo;

		const tierPrompt = TIER_PROMPTS[tierInfo.tier];

		return {
			systemPrompt: event.systemPrompt + `\n\n## Model tier awareness\n${tierPrompt}`,
		};
	});
}
