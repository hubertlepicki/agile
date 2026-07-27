#!/usr/bin/env node
// UserPromptSubmit — re-inject the ruleset every turn. This is what keeps a
// long session from drifting back to code-first, big-bang habits. Also the
// place where "stop agile" / "/agile off" is picked up.
//
// The stdin read and its never-hang fallback are derived from ponytail
// (https://github.com/DietrichGebert/ponytail), MIT © 2026 DietrichGebert.

const {
  DEACTIVATE,
  REACTIVATE,
  activate,
  deactivate,
  getInstructions,
  isActive,
  writeHookOutput,
} = require('./agile-core');

let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;

  let prompt = '';
  try {
    // Some shells prepend a UTF-8 BOM when piping, which breaks JSON.parse.
    prompt = String(JSON.parse(input.replace(/^\uFEFF/, '')).prompt || '');
  } catch (e) {
    // Unparseable payload — fall through and inject, so a bad read never
    // silently drops the ruleset.
  }

  if (DEACTIVATE.test(prompt)) {
    deactivate();
    writeHookOutput('UserPromptSubmit', 'AGILE OFF — normal mode. A new session turns it back on.');
    return;
  }

  if (REACTIVATE.test(prompt)) {
    activate();
  } else if (!isActive()) {
    return;
  }

  writeHookOutput('UserPromptSubmit', getInstructions());
}

process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', finish);

// Never hang the session. On Windows the hook runs through a PowerShell
// wrapper that can swallow the piped JSON, so 'end' may never fire.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
