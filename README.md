<h1 align="center">agile</h1>

<p align="center">
  <em>Talk first. Test first. Small steps. Plain words.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/hosts-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Antigravity%20%C2%B7%20Grok%20Build%20%C2%B7%20OpenCode-111111?style=flat-square" alt="Claude Code, Codex, Antigravity, Grok Build, OpenCode">
</p>

---

Your agent gets a one-line request and starts writing files. No questions, no tests, three abstractions you didn't ask for, and a commit message about dispatching events through the message bus.

`agile` puts a calm senior pair-programmer in there instead. It asks what "done" means before it touches anything, drives the change from a failing test inward, refactors every time the bar goes green, and explains itself in words your product owner would use.

## What it changes

**Before you ask for anything:** a request is a conversation, not a ticket. The agent restates the problem in your domain's words, names what's ambiguous, proposes the behaviors as examples, and waits for a go-ahead. (Say "just do it" and it will.)

**Then it works outside-in:**

```
OUTER LOOP  ── one failing acceptance test ──────────────────────┐
  (feature)     run it, watch it fail for the expected reason    │
                                                                 │
  INNER LOOP  ┌─ RED       smallest failing unit test            │
  (behavior)  │  GREEN     minimum code to pass                  │
              └─ REFACTOR  mandatory, then round again           │
                                                                 │
CLOSE  ── unit tests green first, then the acceptance test ──────┘
          feature-level refactor · commit on green
```

Tests in chunks, code in chunks — never the whole feature at once.

**Every refactor step** drives toward Kent Beck's four rules of simple design, in priority order: passes the tests → reveals intent → no duplication (extract on the *third* repetition) → fewest elements. Tests get refactored too: redundant ones deleted, drifted ones renamed.

**And it stays lean:** only what was asked, no speculative config or abstractions, near-zero comments (the code is the *what*; a comment is a rare *why*), no faked green.

**And it talks straight:** your domain's words, not framework nouns — and said literally. No metaphors, no analogies, no idioms, no writerly flourish. "The handler saves the record but never sends the confirmation email," not "the handler carries the baton one leg."

## Before / after

You ask: *"users should get an email when their order ships."*

**Without it,** the agent writes a `NotificationService`, an `EmailProvider` interface with one implementation, a retry policy, a template registry, and a `notifications.yaml`. No tests. It asked nothing.

**With `agile`,** it asks first:

> Before I start — when an order ships, who gets told, and what does it say? Two behaviors I think you mean:
>
> 1. Shipping an order sends the buyer one email with the tracking link.
> 2. Shipping an already-shipped order sends nothing.
>
> Right? Anything about failed sends?

Then, once you say yes:

```
RED: nothing proves shipping an order emails the buyer. Writing that test.
     Fails — no email sent. Good, that's the gap.
GREEN: buyer emailed on ship. Passing.
REFACTOR: pulled the tracking link out of the template; named it.
```

## Install

### Claude Code

```
/plugin marketplace add hubertlepicki/agile
```
```
/plugin install agile@agile
```

(Two separate prompts.) Same in the Claude Code desktop app's Code tab.

### Codex

```bash
codex plugin marketplace add hubertlepicki/agile
codex plugin add agile@agile
```

Run `codex`, open `/hooks`, review and trust the three lifecycle hooks, then start a new thread. This also covers the Codex desktop app — restart it after installing.

### Antigravity

```bash
agy plugin install https://github.com/hubertlepicki/agile
```

Loads [`AGENTS.md`](AGENTS.md) as always-on context. Until the Gemini CLI rename completes, `gemini extensions install https://github.com/hubertlepicki/agile` works too.

### Grok Build

```bash
grok plugin install hubertlepicki/agile --trust
```

Enable the plugin (off by default): `/plugins` → Plugins → Space on `agile`, or in `~/.grok/config.toml`:

```toml
[plugins]
enabled = ["agile"]
```

Start a new session (or reload plugins). The skill shows as `/agile`. Verify with `grok inspect`. Grok can auto-invoke agile for coding tasks from its skill description; use `/agile` when activation needs to be explicit. Grok lifecycle hooks are not used because their SessionStart output cannot inject instructions.

`AGENTS.md` still works instruction-only from a checkout without the plugin.

### OpenCode

Add to `opencode.json`:

```
{ "plugin": ["@hubertlepicki/agile"] }
```

Run from a checkout instead (the plugin reuses `hooks/` and `skills/`):

```
{ "plugin": ["./.opencode/plugins/agile.mjs"] }
```

Supplies the compact ruleset in each model request's system prompt; adds `/agile` (and `/agile off`). It does not register a second copy as a discoverable skill. OpenCode also auto-loads this repo's `AGENTS.md`, so working inside this checkout loads both copies; installing the npm plugin in other projects does not itself load this repo's `AGENTS.md`. The plugin is what persists off/on across turns.

The `./` path resolves against your project's `opencode.json`; to share one checkout across projects, point it at the absolute path of the `.mjs` instead (it finds its `hooks/` and `skills/` relative to its own file).

The Claude Code and Codex plugins run small Node.js lifecycle hooks, so `node` must be on your `PATH` (Nix/nvm users: on the *non-interactive* shell's PATH). Without it the skill still loads, the hooks just stay quiet.

### Any other agent

Copy [`AGENTS.md`](AGENTS.md) into your project root. Most agents (Cursor, Zed, Amp, Copilot, Codex in VS Code) read it as always-on instructions.

## How persistent is it?

Long sessions drift. Agents slide back to code-first the moment the ruleset falls out of attention, so this plugin re-asserts it rather than trusting one prompt at startup.

| Host | Mechanism | Anti-drift |
|---|---|---|
| **Claude Code** | `SessionStart` (also after compaction/clear) + `UserPromptSubmit` + `SubagentStart` hooks | **Full** — the full ruleset returns after every compaction or clear, a short reminder holds the line every turn in between, and every subagent gets the full ruleset |
| **Codex** | the same three hooks, same file, same event names | **Full** — identical to Claude Code |
| **OpenCode** | `experimental.chat.system.transform` on every model request | **Full** — a complete compact ruleset in each fresh system prompt, without accumulating copies through this hook |
| **Grok Build** | plugin skill + auto-invoke from its description | **Partial** — skill-tier; Grok hooks cannot inject instructions |
| **Antigravity** | `AGENTS.md` as always-on context | **Partial** — instruction-tier only |

Be aware of the last two rows: **Grok Build and Antigravity have no mechanism to recover the ruleset once it falls out of context.** Grok loads `/agile` as a skill (and can auto-invoke it on coding tasks); Antigravity loads `AGENTS.md` once as persistent context. How well the discipline holds over a long session is up to how the host keeps that in the prompt. This plugin cannot add per-turn injection there.

On OpenCode, `/agile off` is what persists the off flag. Saying "stop agile" as ordinary chat is honored for that turn; the next turn injects again unless you used the command.

## Turning it off

Say **"stop agile"** (or "normal mode", or `/agile off`). It stays off for the rest of that session; a new session starts it again. There are no intensity levels and no config file — one always-on mode is the whole design.

## The ruleset

One maintained runtime ruleset, a generated standalone copy, and a rationale document:

| File | Role |
|---|---|
| [`GOAL.md`](GOAL.md) | principles, rationale, and extended examples for maintainers |
| [`skills/agile/SKILL.md`](skills/agile/SKILL.md) | concise, complete runtime rules; edit here |
| [`AGENTS.md`](AGENTS.md) | generated skill body for instruction-tier hosts |

After changing the skill, run `npm run generate:agents` and commit both files.
Update `GOAL.md` when the principles change. Generated instructions ship in the
repository and package; users do not need to run a generator. Tests reject an
out-of-date copy and enforce size budgets for the rules and discovery description.

The compact rules keep all required behavior together; agents do not need extra
file reads to recover required instructions. Claude Code and Codex retain their
short per-prompt reminder and complete startup, compaction, and subagent context.
Grok retains automatic skill discovery. Token savings depend on the model's
tokenizer and prompt caching; instruction length is not total session cost.

## FAQ

**Doesn't asking questions first slow everything down?**
That's the point. The expensive part isn't typing code, it's building the wrong thing correctly. One round of questions is cheaper than one wrong feature.

**Won't the tests be slow to write?**
They're the spec. You were going to describe the behavior anyway — this way the description runs.

**Can I pair it with something like [ponytail](https://github.com/DietrichGebert/ponytail)?**
Yes — and `agile` borrows its plumbing, see [Credits](#credits). Ponytail shrinks what gets built; `agile` governs how it gets built and talked about. They overlap on "do less" and agree there.

**Why no `/agile-plan`, `/agile-refactor`, …?**
The loop is always on, and refactoring already runs on every green. A command would just be a second way to ask for what's already happening.

## Credits

The plugin scaffolding here stands on [ponytail](https://github.com/DietrichGebert/ponytail) by [Dietrich Gebert](https://github.com/DietrichGebert) (MIT). It worked out how to keep a ruleset alive in an agent across Claude Code, Codex, Grok Build, OpenCode, and instruction-only hosts, and `agile` reuses that machinery: the lifecycle hook map, the per-host output shapes, the Grok skill-only marketplace (Grok hooks cannot inject instructions), the OpenCode system-prompt inject, and the stdin read with its never-hang fallback — including the Windows PowerShell edge case that is only obvious once it has bitten you.

Borrowed with thanks, and with its copyright notice kept intact in [LICENSE](LICENSE). The ruleset itself — [`GOAL.md`](GOAL.md), [`SKILL.md`](skills/agile/SKILL.md), [`AGENTS.md`](AGENTS.md) — is our own; ponytail governs *how much* gets built, `agile` governs *how* it gets built.

The ideas in the ruleset aren't ours either, and predate all of this: Kent Beck (TDD, the four rules of simple design), Freeman & Pryce (outside-in / *Growing Object-Oriented Software, Guided by Tests*), Ron Jeffries (a story is a promise for a conversation), Eric Evans (ubiquitous language), the Poppendiecks (lean, work not done), and the Agile Manifesto authors.

## License

[MIT](LICENSE) — same licence as ponytail, whose copyright notice it carries.
