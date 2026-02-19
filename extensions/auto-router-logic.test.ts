import { describe, it, expect } from "bun:test";
import { quickClassify, parseRoutingDecision, OPUS_SIGNALS } from "./auto-router-logic";

// ---------------------------------------------------------------------------
// quickClassify
// ---------------------------------------------------------------------------

describe("quickClassify", () => {
	// Short prompts
	it("returns sonnet for a short prompt under 100 chars", () => {
		expect(quickClassify("what does this function do?")).toBe("sonnet");
	});

	it("returns sonnet for an empty prompt", () => {
		expect(quickClassify("")).toBe("sonnet");
	});

	it("returns sonnet for a prompt of exactly 99 chars", () => {
		const prompt = "a".repeat(99);
		expect(quickClassify(prompt)).toBe("sonnet");
	});

	// Medium prompts (100-399 chars) without opus signals -> sonnet
	it("returns sonnet for a medium prompt with no opus signals", () => {
		const prompt = "Can you add a button to the homepage that opens a modal with a confirmation message? ".repeat(2);
		expect(prompt.length).toBeGreaterThanOrEqual(100);
		expect(prompt.length).toBeLessThan(400);
		expect(quickClassify(prompt)).toBe("sonnet");
	});

	it("returns sonnet for a 399-char prompt with no opus signals", () => {
		const prompt = "x".repeat(399);
		expect(quickClassify(prompt)).toBe("sonnet");
	});

	// Long prompts without signals -> uncertain
	it("returns uncertain for a long prompt with no opus signals", () => {
		const prompt = "x".repeat(400);
		expect(quickClassify(prompt)).toBe("uncertain");
	});

	it("returns uncertain for a very long prompt with no opus signals", () => {
		const prompt = "Please help me understand this codebase. ".repeat(20);
		expect(prompt.length).toBeGreaterThanOrEqual(400);
		expect(quickClassify(prompt)).toBe("uncertain");
	});

	// Opus signals -- short phrases in otherwise short prompts still trigger
	it("returns opus for a prompt containing 'race condition'", () => {
		const prompt = "There's a race condition in the auth middleware, can you help debug it?";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'memory leak'", () => {
		const prompt = "My server has a memory leak that only shows up in production after a few hours";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'architect'", () => {
		const prompt = "Help me architect a multi-tenant SaaS backend from scratch";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'migration strategy'", () => {
		const prompt = "What's the best migration strategy for moving from a monolith to microservices?";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'security audit'", () => {
		const prompt = "Can you do a security audit of this authentication flow?";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'deadlock'", () => {
		const prompt = "I think there's a deadlock in the database transaction logic";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'across the codebase'", () => {
		const prompt = "Rename UserService to AccountService across the codebase";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'technical spec'", () => {
		const prompt = "Write a technical spec for the new payments integration";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'state machine'", () => {
		const prompt = "Design a state machine for order lifecycle management";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'walk me through'", () => {
		const prompt = "Walk me through why this recursive algorithm is producing incorrect results";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'explain the root cause'", () => {
		const prompt = "Explain the root cause of this intermittent 500 error in the API";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("returns opus for a prompt containing 'trade-off'", () => {
		const prompt = "What's the trade-off between using Redis vs Postgres for session storage?";
		expect(quickClassify(prompt)).toBe("opus");
	});

	it("is case-insensitive for opus signals", () => {
		expect(quickClassify("Help me ARCHITECT this system")).toBe("opus");
		expect(quickClassify("There is a RACE CONDITION in this code")).toBe("opus");
	});

	it("detects opus signals in long prompts (overrides uncertain)", () => {
		const base = "x".repeat(400); // would otherwise be uncertain
		const prompt = base + " memory leak";
		expect(quickClassify(prompt)).toBe("opus");
	});
});

// ---------------------------------------------------------------------------
// parseRoutingDecision
// ---------------------------------------------------------------------------

describe("parseRoutingDecision", () => {
	it("returns opus for 'opus'", () => {
		expect(parseRoutingDecision("opus")).toBe("opus");
	});

	it("returns sonnet for 'sonnet'", () => {
		expect(parseRoutingDecision("sonnet")).toBe("sonnet");
	});

	it("is case-insensitive", () => {
		expect(parseRoutingDecision("OPUS")).toBe("opus");
		expect(parseRoutingDecision("Sonnet")).toBe("sonnet");
	});

	it("trims whitespace", () => {
		expect(parseRoutingDecision("  opus  ")).toBe("opus");
		expect(parseRoutingDecision("\nsonnet\n")).toBe("sonnet");
	});

	it("defaults to sonnet for unexpected output", () => {
		expect(parseRoutingDecision("gpt-4")).toBe("sonnet");
		expect(parseRoutingDecision("")).toBe("sonnet");
		expect(parseRoutingDecision("unclear")).toBe("sonnet");
	});
});

// ---------------------------------------------------------------------------
// OPUS_SIGNALS sanity checks
// ---------------------------------------------------------------------------

describe("OPUS_SIGNALS", () => {
	it("is a non-empty array", () => {
		expect(OPUS_SIGNALS.length).toBeGreaterThan(0);
	});

	it("contains no duplicate entries", () => {
		const unique = new Set(OPUS_SIGNALS);
		expect(unique.size).toBe(OPUS_SIGNALS.length);
	});

	it("all signals are lowercase", () => {
		for (const s of OPUS_SIGNALS) {
			expect(s).toBe(s.toLowerCase());
		}
	});
});
