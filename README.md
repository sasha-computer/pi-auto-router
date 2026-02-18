# pi-model-tier-coach

A [pi](https://github.com/badlogic/pi-mono) extension that nudges you when your task doesn't match your model's cost tier.

Using Opus to read a file? Waste. Using Haiku for a complex refactor? Underpowered. This extension adds a short system prompt instruction so the model flags the mismatch at the end of its response -- a quick nudge, not a lecture.

Inspired by [@JordanLyall's tweet](https://x.com/JordanLyall/status/1891644803049427234).

## Install

```bash
pi install npm:pi-model-tier-coach
```

Or try it without installing:

```bash
pi -e npm:pi-model-tier-coach
```

## How it works

The extension hooks into `before_agent_start` -- the event that fires after you submit a prompt but before the LLM runs. It checks which model is active, classifies it into a cost tier, and appends tier-specific instructions to the system prompt.

**Tiers:**

| Tier | Models | Behavior |
|------|--------|----------|
| Premium | Opus, o1, o3, GPT-4.5 | Nudges on simple tasks (reads, lookups, small edits) |
| Standard | Sonnet, GPT-4o, Gemini Pro | Nudges on genuinely complex work (architecture, deep debugging) |
| Budget | Haiku, mini, Flash | Nudges when the task is clearly too complex |

The nudge is always at the end of the response, never before the actual work. It won't repeat if it already nudged recently.

## License

MIT
