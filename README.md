# pi-auto-router

A [pi](https://github.com/badlogic/pi-mono) extension that automatically routes prompts to the right model.

No more manual model switching. You type a prompt, Haiku classifies it (~300ms, fractions of a cent), and the request goes to Sonnet or Opus. Simple tasks go to Sonnet. Complex architecture, subtle debugging, and deep reasoning go to Opus.

## Install

```bash
pi install npm:pi-auto-router
```

Or try it without installing:

```bash
pi -e npm:pi-auto-router
```

## How it works

The extension hooks into `before_agent_start`. Before each LLM call:

1. Sends your prompt to Haiku with a classification instruction
2. Haiku responds with one word: `sonnet` or `opus`
3. Extension calls `pi.setModel()` to switch to the right model
4. Status bar shows `→ sonnet` or `→ opus` so you can see what it picked

**Manual override:** If you switch models with `Ctrl+P` or `Ctrl+L`, the router respects your choice for that turn, then resumes auto-routing.

**Models:**

| Router | Target | When |
|--------|--------|------|
| Haiku 4.5 | Sonnet 4.6 | Most tasks: edits, lookups, commands, standard refactors |
| Haiku 4.5 | Opus 4.6 | Complex: architecture, subtle bugs, multi-file refactors, deep reasoning |

## Cost

The Haiku classification call adds ~$0.0001 per prompt. Over a full day of coding, maybe $0.01-0.05 extra. The savings from not running Opus on simple tasks far outweigh this.

## License

MIT
