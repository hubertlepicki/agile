// Shared state, ruleset loading, and hook output for the agile lifecycle hooks.
//
// One always-on mode. The flag file marks the exception: present = the user
// turned agile off for this session. Absent = active, which is the default and
// the common case.
//
// Host detection and the hook output shapes below are derived from ponytail
// (https://github.com/DietrichGebert/ponytail), MIT © 2026 DietrichGebert.

const fs = require('fs');
const os = require('os');
const path = require('path');

const OFF_FLAG = '.agile-off';
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'agile', 'SKILL.md');
const AGENTS_PATH = path.join(__dirname, '..', 'AGENTS.md');

// Codex exports PLUGIN_DATA as its per-plugin state directory; Claude Code
// does not. That is the only host difference the hooks care about.
const isCodex = Boolean(process.env.PLUGIN_DATA);

const stateDir = isCodex
  ? process.env.PLUGIN_DATA
  : (process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'));

const flagPath = path.join(stateDir, OFF_FLAG);

const DEACTIVATE = /^\s*(?:[/@$]agile\s+off|stop\s+agile|agile\s+off|normal\s+mode)\s*$/i;
const REACTIVATE = /^\s*(?:[/@$]agile(?:\s+on)?|start\s+agile|agile\s+on|resume\s+agile)\s*$/i;

function isActive() {
  return !fs.existsSync(flagPath);
}

function deactivate() {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(flagPath, '');
  } catch (e) {
    // Best-effort: a state write must never block the session.
  }
}

function activate() {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

// The skill file is the ruleset. AGENTS.md carries the same rules compact, so
// it is the fallback rather than a third copy that could drift.
function getInstructions() {
  for (const file of [SKILL_PATH, AGENTS_PATH]) {
    try {
      const body = fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?\n---\s*/, '');
      return 'AGILE MODE ACTIVE\n\n' + body.trim();
    } catch (e) {
      continue;
    }
  }
  return 'AGILE MODE ACTIVE\n\n' +
    'You are a calm, senior pair-programmer. Talk before you code: restate the ' +
    'problem in domain words, ask what is ambiguous, agree on the target behaviors ' +
    'as examples, and write no code until you have a go-ahead. Then work outside-in: ' +
    'one failing acceptance test that fails for the expected reason, then small ' +
    'red/green/refactor unit cycles in chunks — smallest failing test, minimum code ' +
    'to pass, then refactor toward passing tests, revealed intent, no duplication ' +
    '(extract on the third repetition), fewest elements. Refactor the tests too. ' +
    'Close the loops from the inside out: unit tests green, then the acceptance test. ' +
    'Build only what was asked; extra code is inventory. Names carry the meaning, ' +
    'functions stay small, comments are a rare "why" — default to none. Never fake ' +
    'green by deleting, skipping, or weakening a test. Speak simple domain language ' +
    'a non-programmer can follow, in conversation, test names, and commit messages.';
}

function writeHookOutput(event, context) {
  try {
    if (isCodex) {
      const output = { systemMessage: 'AGILE' };
      if (context) {
        output.hookSpecificOutput = { hookEventName: event, additionalContext: context };
      }
      process.stdout.write(JSON.stringify(output));
      return;
    }
    // Claude Code takes raw stdout as context for SessionStart and
    // UserPromptSubmit, but drops SubagentStart context unless it is wrapped.
    if (event === 'SubagentStart') {
      process.stdout.write(JSON.stringify(
        { hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
      return;
    }
    process.stdout.write(context);
  } catch (e) {
    // A closed stdout at hook exit must not surface as a hook failure.
  }
}

module.exports = {
  DEACTIVATE,
  REACTIVATE,
  activate,
  deactivate,
  getInstructions,
  isActive,
  writeHookOutput,
};
