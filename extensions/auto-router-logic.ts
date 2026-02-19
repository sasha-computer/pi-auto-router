/**
 * Pure logic for auto-router -- no pi API imports, fully testable.
 */

/** Keyword signals that strongly indicate a prompt needs Opus. */
export const OPUS_SIGNALS: string[] = [
	// Debugging complexity
	"flaky test",
	"intermittent",
	"heisenbug",
	"deadlock",
	"race condition",
	"memory leak",
	"segfault",
	"corruption",
	"off-by-one",
	// Architecture / design
	"design a system",
	"architect",
	"trade-off",
	"migration strategy",
	"how should i structure",
	"what's the right abstraction",
	"what is the right abstraction",
	// Multi-file / large scope
	"refactor across",
	"rename throughout",
	"move this module",
	"split this into",
	"merge these into",
	"across the codebase",
	// Deep analysis
	"explain the root cause",
	"what's wrong with this approach",
	"what is wrong with this approach",
	"review this design",
	"security audit",
	"performance analysis",
	// Novel / algorithmic
	"implement an algorithm",
	"write a parser",
	"state machine",
	"lock-free",
	"backtracking",
	// Long-form writing
	"write a proposal",
	" rfc",
	"design doc",
	"architecture decision record",
	" adr",
	"technical spec",
	// Multi-step reasoning
	"step by step",
	"walk me through",
	"debug this with me",
	"figure out why",
	"trace through",
];

export type QuickClassification = "sonnet" | "opus" | "uncertain";

/**
 * Fast local classification -- avoids a Haiku API call for obvious cases.
 *
 * - Short prompts (<100 chars) are almost always simple tasks -> sonnet
 * - Prompts containing strong opus signals -> opus
 * - Medium prompts (100-399 chars) without signals -> sonnet
 * - Longer prompts without clear signals -> uncertain (call Haiku)
 */
export function quickClassify(prompt: string): QuickClassification {
	const p = prompt.toLowerCase();

	// Strong opus signals take priority regardless of length -- skip Haiku
	if (OPUS_SIGNALS.some((s) => p.includes(s))) return "opus";

	// Short or medium prompts without opus signals are sonnet territory
	if (prompt.length < 400) return "sonnet";

	// Longer prompts without clear signals -- let Haiku decide
	return "uncertain";
}

/**
 * Parses the single-word routing decision returned by Haiku.
 * Defaults to "sonnet" on any unexpected output.
 */
export function parseRoutingDecision(answer: string): "sonnet" | "opus" {
	return answer.trim().toLowerCase().includes("opus") ? "opus" : "sonnet";
}
