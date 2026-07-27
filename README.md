<h1 align="center">agile</h1>

<p align="center">
  <em>Talk first. Test first. Small steps. Plain words.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/hosts-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Antigravity-111111?style=flat-square" alt="Claude Code, Codex, Antigravity">
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

## Before / after

You ask: *"users should get an email when their order ships."*

<table>
<tr><th align="left">Without</th><th align="left">With <code>agile</code></th></tr>
<tr valign="top"><td>

Writes `NotificationService`, an `EmailProvider` interface with one implementation, a retry policy, a template registry, and a `notifications.yaml`. No tests. Asks nothing.

</td><td>

> Before I start — when an order ships, who gets told, and what does it say? Two behaviors I think you mean:
> 1. Shipping an order sends the buyer one email with the tracking link.
> 2. Shipping an already-shipped order sends nothing.
>
> Right? Anything about failed sends?

Then, after you say yes:

```
RED: nothing proves shipping an order emails the buyer. Writing that test.
     Fails — no email sent. Good, that's the gap.
GREEN: buyer emailed on ship. Passing.
REFACTOR: pulled the tracking link out of the template; named it.
```

</td></tr>
</table>

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

The Claude Code and Codex plugins run small Node.js lifecycle hooks, so `node` must be on your `PATH` (Nix/nvm users: on the *non-interactive* shell's PATH). Without it the skill still loads, the hooks just stay quiet.

### Any other agent

Copy [`AGENTS.md`](AGENTS.md) into your project root. Most agents (Cursor, Zed, Amp, Copilot, Codex in VS Code) read it as always-on instructions.

## How persistent is it?

Long sessions drift. Agents slide back to code-first the moment the ruleset falls out of attention, so this plugin re-asserts it rather than trusting one prompt at startup.

| Host | Mechanism | Anti-drift |
|---|---|---|
| **Claude Code** | `SessionStart` + `UserPromptSubmit` + `SubagentStart` hooks | **Full** — the ruleset is re-injected on *every turn*, and into every subagent |
| **Codex** | the same three hooks, same file, same event names | **Full** — identical to Claude Code |
| **Antigravity** | `AGENTS.md` as always-on context | **Partial** — instruction-tier only |

Be aware of the third row: **Antigravity does not run these hooks.** It loads `AGENTS.md` once as persistent context, so how well the discipline holds over a long session is up to how the host keeps that file in the prompt. There is no per-turn re-injection there, and this plugin cannot add one.

## Turning it off

Say **"stop agile"** (or "normal mode", or `/agile off`). It stays off for the rest of that session; a new session starts it again. There are no intensity levels and no config file — one always-on mode is the whole design.

## The ruleset

One set of rules, three renderings, all kept in sync:

| File | Role |
|---|---|
| [`GOAL.md`](GOAL.md) | source of truth — the principles and why they're there |
| [`skills/agile/SKILL.md`](skills/agile/SKILL.md) | the full ruleset the agent loads |
| [`AGENTS.md`](AGENTS.md) | compact copy for instruction-tier hosts |

Change one, change all three.

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

The plugin scaffolding here stands on [ponytail](https://github.com/DietrichGebert/ponytail) by [Dietrich Gebert](https://github.com/DietrichGebert) (MIT). It worked out how to keep a ruleset alive in an agent across Claude Code, Codex, and instruction-only hosts, and `agile` reuses that machinery: the lifecycle hook map, the per-host output shapes, and the stdin read with its never-hang fallback — including the Windows PowerShell edge case that is only obvious once it has bitten you.

Borrowed with thanks, and with its copyright notice kept intact in [LICENSE](LICENSE). The ruleset itself — [`GOAL.md`](GOAL.md), [`SKILL.md`](skills/agile/SKILL.md), [`AGENTS.md`](AGENTS.md) — is our own; ponytail governs *how much* gets built, `agile` governs *how* it gets built.

The ideas in the ruleset aren't ours either, and predate all of this: Kent Beck (TDD, the four rules of simple design), Freeman & Pryce (outside-in / *Growing Object-Oriented Software, Guided by Tests*), Ron Jeffries (a story is a promise for a conversation), Eric Evans (ubiquitous language), the Poppendiecks (lean, work not done), and the Agile Manifesto authors.

## License

[MIT](LICENSE) — same licence as ponytail, whose copyright notice it carries.
