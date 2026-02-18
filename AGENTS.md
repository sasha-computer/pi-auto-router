# AGENTS.md

## Project

pi-auto-router is a pi extension that automatically routes prompts to the right Claude model based on task complexity. Uses Haiku as a cheap classifier to decide between Sonnet (standard tasks) and Opus (complex tasks) before each agent turn.

## Structure

```
extensions/model-tier-coach.ts   # Single-file extension
package.json                     # pi package metadata
README.md                        # User-facing docs
CLAUDE.md                        # Agent context (Claude Code)
AGENTS.md                        # Agent context (shared)
```

## How it works

1. User submits a prompt
2. `before_agent_start` hook fires
3. Extension sends the prompt to Haiku (`claude-haiku-4-5`) via direct Anthropic API call
4. Haiku responds with "sonnet" or "opus"
5. Extension calls `pi.setModel()` to switch to the target model
6. The agent runs on the selected model
7. Status bar shows `→ sonnet` or `→ opus`

Manual model changes via `Ctrl+P`/`Ctrl+L` set a one-turn override flag. The router skips classification for that turn, then resumes.

## Build and test

No build step. pi loads TypeScript directly via jiti.

Manual testing:
```bash
pi -e ./extensions    # Load extension from local directory
```

## Key patterns

- Raw `fetch()` to Anthropic Messages API for classification
- API key resolved via `ctx.modelRegistry.getApiKey()`
- `pi.setModel()` for model switching
- `ctx.ui.setStatus()` for status bar feedback
- `model_select` event to detect manual overrides
- Default to Sonnet on any classification failure

## Conventions

- No em dashes in prose
- Atomic commits, rebase workflow
- Model IDs are constants at the top of the file -- update when new versions drop
