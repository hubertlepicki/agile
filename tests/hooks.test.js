#!/usr/bin/env node
// Claude Code and Codex run the lifecycle hooks as separate node processes.
// These cases spawn the real scripts against a temp home and check the
// flag file and stdout shape each host needs.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

delete process.env.CLAUDE_CONFIG_DIR;
delete process.env.PLUGIN_DATA;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agile-hooks-'));
const home = path.join(temp, 'home');
fs.mkdirSync(home, { recursive: true });

const { DEACTIVATE, REACTIVATE, getInstructions } = require('../hooks/agile-core');

function run(script, env, input = '') {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
  });
}

function promptPayload(prompt) {
  return JSON.stringify({ prompt });
}

const claudeEnv = { HOME: home, USERPROFILE: home };
const claudeFlag = path.join(home, '.claude', '.agile-off');

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('off phrases match only as the whole prompt', () => {
  for (const phrase of ['stop agile', '/agile off', '@agile off', '$agile off', 'agile off', 'normal mode', '  STOP AGILE  ']) {
    assert.equal(DEACTIVATE.test(phrase), true, `should turn off: ${JSON.stringify(phrase)}`);
  }
  assert.equal(DEACTIVATE.test('add a normal mode toggle next to dark mode'), false);
  assert.equal(DEACTIVATE.test('please stop agile'), false);
});

test('on phrases match only as the whole prompt', () => {
  for (const phrase of ['/agile', '/agile on', '@agile', 'start agile', 'agile on', 'resume agile']) {
    assert.equal(REACTIVATE.test(phrase), true, `should turn on: ${JSON.stringify(phrase)}`);
  }
  assert.equal(REACTIVATE.test('lets start agile tomorrow'), false);
});

test('SessionStart on Claude writes the ruleset as raw stdout and starts on', () => {
  fs.mkdirSync(path.dirname(claudeFlag), { recursive: true });
  fs.writeFileSync(claudeFlag, '');
  const result = run('agile-activate.js', claudeEnv);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(claudeFlag), false);
  assert.match(result.stdout, /AGILE MODE ACTIVE/);
  assert.match(result.stdout, /conversation, not a ticket/i);
  assert.equal(result.stdout.trimStart().startsWith('{'), false, 'Claude SessionStart must be raw text, not JSON');
});

test('SessionStart on Codex wraps the ruleset in hookSpecificOutput JSON', () => {
  const pluginData = path.join(temp, 'codex-session');
  fs.mkdirSync(pluginData, { recursive: true });
  fs.writeFileSync(path.join(pluginData, '.agile-off'), '');
  const result = run('agile-activate.js', { ...claudeEnv, PLUGIN_DATA: pluginData });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(pluginData, '.agile-off')), false);
  const output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'AGILE');
  assert.equal(output.additionalContext, undefined);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /AGILE MODE ACTIVE/);
});

test('SessionStart stores the flag under CLAUDE_CONFIG_DIR, not ~/.claude', () => {
  const home2 = path.join(temp, 'home2');
  const custom = path.join(temp, 'custom-claude');
  fs.mkdirSync(home2, { recursive: true });
  fs.mkdirSync(path.join(custom), { recursive: true });
  fs.writeFileSync(path.join(custom, '.agile-off'), '');
  const result = run('agile-activate.js', {
    HOME: home2,
    USERPROFILE: home2,
    CLAUDE_CONFIG_DIR: custom,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(custom, '.agile-off')), false);
  assert.equal(fs.existsSync(path.join(home2, '.claude', '.agile-off')), false);
});

test('UserPromptSubmit stop agile writes the off flag and the off line', () => {
  try { fs.unlinkSync(claudeFlag); } catch (e) {}
  const result = run('agile-prompt.js', claudeEnv, promptPayload('stop agile'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(claudeFlag), true);
  assert.match(result.stdout, /AGILE OFF/);
});

test('UserPromptSubmit /agile off turns agile off', () => {
  try { fs.unlinkSync(claudeFlag); } catch (e) {}
  const result = run('agile-prompt.js', claudeEnv, promptPayload('/agile off'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(claudeFlag), true);
  assert.match(result.stdout, /AGILE OFF/);
});

test('UserPromptSubmit does not turn off when a request only mentions normal mode', () => {
  try { fs.unlinkSync(claudeFlag); } catch (e) {}
  const result = run('agile-prompt.js', claudeEnv, promptPayload('add a normal mode toggle next to dark mode'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(claudeFlag), false);
  assert.match(result.stdout, /AGILE MODE ACTIVE/);
});

test('UserPromptSubmit reminds in one short line on an ordinary turn, instead of re-injecting the full ruleset', () => {
  try { fs.unlinkSync(claudeFlag); } catch (e) {}
  const result = run('agile-prompt.js', claudeEnv, promptPayload('add a login form'));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AGILE MODE ACTIVE/);
  assert.ok(result.stdout.length < 300, `expected a short reminder, got ${result.stdout.length} chars`);
  assert.doesNotMatch(result.stdout, /conversation, not a ticket/i);
});

test('UserPromptSubmit /agile on still injects the full ruleset, since the session lost context while off', () => {
  fs.mkdirSync(path.dirname(claudeFlag), { recursive: true });
  fs.writeFileSync(claudeFlag, '');
  const result = run('agile-prompt.js', claudeEnv, promptPayload('/agile on'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(claudeFlag), false);
  assert.match(result.stdout, /AGILE MODE ACTIVE/);
  assert.match(result.stdout, /conversation, not a ticket/i);
});

test('UserPromptSubmit stays silent while agile is off', () => {
  fs.mkdirSync(path.dirname(claudeFlag), { recursive: true });
  fs.writeFileSync(claudeFlag, '');
  const result = run('agile-prompt.js', claudeEnv, promptPayload('write a function'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('UserPromptSubmit /agile on clears the flag and injects again', () => {
  fs.mkdirSync(path.dirname(claudeFlag), { recursive: true });
  fs.writeFileSync(claudeFlag, '');
  const result = run('agile-prompt.js', claudeEnv, promptPayload('/agile on'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(claudeFlag), false);
  assert.match(result.stdout, /AGILE MODE ACTIVE/);
});

test('UserPromptSubmit on Codex uses hookSpecificOutput and not top-level additionalContext', () => {
  const pluginData = path.join(temp, 'codex-prompt');
  fs.mkdirSync(pluginData, { recursive: true });
  const result = run(
    'agile-prompt.js',
    { ...claudeEnv, PLUGIN_DATA: pluginData },
    promptPayload('write a function'),
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'AGILE');
  assert.equal(output.additionalContext, undefined);
  assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(output.hookSpecificOutput.additionalContext, /AGILE MODE ACTIVE/);
});

test('UserPromptSubmit still injects when the payload has a UTF-8 BOM', () => {
  try { fs.unlinkSync(claudeFlag); } catch (e) {}
  const result = run('agile-prompt.js', claudeEnv, '\uFEFF' + promptPayload('write a function'));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AGILE MODE ACTIVE/);
});

test('UserPromptSubmit still injects the full ruleset when the payload is not JSON, since the prompt could not be read', () => {
  try { fs.unlinkSync(claudeFlag); } catch (e) {}
  const result = run('agile-prompt.js', claudeEnv, 'not-json');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AGILE MODE ACTIVE/);
  assert.match(result.stdout, /conversation, not a ticket/i);
});

test('SubagentStart on Claude wraps the ruleset so the host does not drop it', () => {
  try { fs.unlinkSync(claudeFlag); } catch (e) {}
  const result = run('agile-subagent.js', claudeEnv);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.equal(output.hookSpecificOutput.additionalContext, getInstructions());
});

test('SubagentStart on Codex includes the badge and hookSpecificOutput', () => {
  const pluginData = path.join(temp, 'codex-sub');
  fs.mkdirSync(pluginData, { recursive: true });
  const result = run('agile-subagent.js', { ...claudeEnv, PLUGIN_DATA: pluginData });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'AGILE');
  assert.equal(output.additionalContext, undefined);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.equal(output.hookSpecificOutput.additionalContext, getInstructions());
});

test('compaction restores the complete active ruleset on Claude and Codex', () => {
  const pluginData = path.join(temp, 'codex-compact');
  const payload = JSON.stringify({ source: 'compact' });
  const claude = run('agile-activate.js', claudeEnv, payload);
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(claude.stdout, getInstructions());
  const codex = run('agile-activate.js', { ...claudeEnv, PLUGIN_DATA: pluginData }, payload);
  assert.equal(codex.status, 0, codex.stderr);
  assert.equal(JSON.parse(codex.stdout).hookSpecificOutput.additionalContext, getInstructions());
});

test('SubagentStart stays silent when agile is off', () => {
  fs.mkdirSync(path.dirname(claudeFlag), { recursive: true });
  fs.writeFileSync(claudeFlag, '');
  const result = run('agile-subagent.js', claudeEnv);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});
