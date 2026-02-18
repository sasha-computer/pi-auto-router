# CLAUDE.md

## What this is

pi-auto-router is a pi extension that automatically routes prompts to Sonnet or Opus based on complexity. Haiku classifies each prompt before the agent runs, then `pi.setModel()` switches to the right model.

## Structure

```
extensions/model-tier-coach.ts   # The extension (single file)
package.json                     # pi package config
README.md                        # Docs
```

## Key decisions

- **Haiku as classifier, not executor.** Haiku only decides which model to use. It never handles the actual task. Two separate API calls.
- **`before_agent_start` hook, not `input`.** We need `ctx.modelRegistry` and `pi.setModel()` which are available in `before_agent_start`. The `input` event fires earlier and can transform text but can't switch models.
- **Manual override respected for one turn.** If you press `Ctrl+P` or `Ctrl+L`, the `model_select` event sets a flag. The next `before_agent_start` skips classification and clears the flag. After that, auto-routing resumes.
- **Default to Sonnet.** If Haiku's response is unclear or the classification fails, we fall through to Sonnet. Never fail open to the expensive model.
- **Direct fetch to Anthropic API.** The extension makes a raw HTTP call to `api.anthropic.com` using the API key from `ctx.modelRegistry.getApiKey()`. No SDK dependency needed.
- **Status bar feedback.** `ctx.ui.setStatus("router", "→ sonnet")` shows what the router picked. Cleared on error.

## Model IDs

Constants at the top of the extension:

```
SONNET_ID = "claude-sonnet-4-6"
OPUS_ID   = "claude-opus-4-6"
HAIKU_ID  = "claude-haiku-4-5"
```

Update these when new model versions drop.

## Testing

No automated tests yet. To test manually:

1. `pi -e ./extensions` from this directory
2. Try simple prompts ("read package.json") -- should route to Sonnet
3. Try complex prompts ("redesign the auth system to use OAuth2 with PKCE") -- should route to Opus
4. Check the status bar shows `→ sonnet` or `→ opus`
5. Press `Ctrl+P` to manually switch, send a prompt -- router should skip that turn
6. Send another prompt -- router should resume

## Gotchas

- The extension file is still named `model-tier-coach.ts` (from the original project name). The filename doesn't matter for pi package discovery since `package.json` points to the `./extensions` directory.
- `enabledModels` in pi settings only takes effect on a full restart, not `/reload`. If the model picker looks wrong after config changes, restart pi.
- The Haiku API call is blocking in `before_agent_start`. If Anthropic is slow, it adds latency before every response. The call typically takes 200-500ms.
