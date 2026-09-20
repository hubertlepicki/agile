#!/usr/bin/env node
// Smoke test for the OpenCode adapter: the plugin's hooks behave against the
// real (structural) OpenCode hook shapes. No live OpenCode needed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

// Point the plugin's off-flag at a temp config home BEFORE it loads — the
// plugin resolves its state path once at load (as it does under a real OpenCode
// process, where XDG_CONFIG_HOME is already set).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agile-opencode-'));
process.env.XDG_CONFIG_HOME = tmp;
const flagPath = path.join(tmp, 'opencode', '.agile-off');

let loadPlugin, pluginModule, parseCommandFile;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'agile.mjs'));
  pluginModule = await import(url);
  loadPlugin = pluginModule.default;
  parseCommandFile = require(path.join(__dirname, '..', '.opencode', 'plugins', 'agile-frontmatter.cjs')).parseCommandFile;
});

function transform(hooks) {
  const output = { system: [] };
  return hooks['experimental.chat.system.transform']({ model: {} }, output).then(() => output.system);
}

test('a new OpenCode process starts agile on, even if the last one left it off', async () => {
  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, '');
  const hooks = await loadPlugin({});
  assert.equal(fs.existsSync(flagPath), false);
  const system = await transform(hooks);
  assert.match(system[0], /AGILE MODE ACTIVE/);
});

test('system.transform injects the ruleset when agile is on', async () => {
  try { fs.unlinkSync(flagPath); } catch (e) {}
  const hooks = await loadPlugin({});
  const system = await transform(hooks);
  assert.equal(system.length, 1);
  assert.match(system[0], /AGILE MODE ACTIVE/);
  assert.match(system[0], /conversation, not a ticket/i);
});

test('/agile off persists off and transform injects nothing', async () => {
  const hooks = await loadPlugin({});
  await hooks['command.execute.before']({ command: 'agile', arguments: 'off', sessionID: 's' });
  assert.equal(fs.existsSync(flagPath), true);
  const system = await transform(hooks);
  assert.deepEqual(system, []);
});

test('/agile (no args) or /agile on removes the flag and injects again', async () => {
  const hooks = await loadPlugin({});
  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, '');
  await hooks['command.execute.before']({ command: 'agile', arguments: '', sessionID: 's' });
  assert.equal(fs.existsSync(flagPath), false);
  const system = await transform(hooks);
  assert.match(system[0], /AGILE MODE ACTIVE/);

  fs.writeFileSync(flagPath, '');
  await hooks['command.execute.before']({ command: 'agile', arguments: 'on', sessionID: 's' });
  assert.equal(fs.existsSync(flagPath), false);
});

test('unsupported /agile arguments and other commands do not touch the flag', async () => {
  try { fs.unlinkSync(flagPath); } catch (e) {}
  const hooks = await loadPlugin({});
  await hooks['command.execute.before']({ command: 'agile', arguments: 'status', sessionID: 's' });
  assert.equal(fs.existsSync(flagPath), false);
  await hooks['command.execute.before']({ command: 'commit', arguments: 'x', sessionID: 's' });
  assert.equal(fs.existsSync(flagPath), false);

  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, '');
  await hooks['command.execute.before']({ command: 'agile', arguments: 'status', sessionID: 's' });
  assert.equal(fs.existsSync(flagPath), true);
});

test('system.transform merges into existing system entry', async () => {
  try { fs.unlinkSync(flagPath); } catch (e) {}
  const hooks = await loadPlugin({});
  const output = { system: ['You are a helpful assistant.'] };
  await hooks['experimental.chat.system.transform']({ model: {} }, output);
  assert.equal(output.system.length, 1, 'must not add a second system entry');
  assert.match(output.system[0], /You are a helpful assistant/);
  assert.match(output.system[0], /AGILE MODE ACTIVE/);
});

test('plugin module exports only the plugin function', () => {
  const fns = Object.values(pluginModule).filter((v) => typeof v === 'function');
  assert.equal(fns.length, 1);
  assert.equal(fns[0], pluginModule.default);
});

test('config registers /agile without advertising a duplicate skill', async () => {
  const hooks = await loadPlugin({});
  const config = {};
  await hooks.config(config);
  assert.ok(config.command && config.command.agile, 'must register the agile command');
  assert.match(config.command.agile.description, /agile/i);
  assert.match(config.command.agile.template, /off/i);
  assert.equal(config.skills, undefined);
});

test('config preserves skills registered by the user', async () => {
  const hooks = await loadPlugin({});
  const config = { skills: { paths: ['/user/skills'] } };
  await hooks.config(config);
  assert.deepEqual(config.skills, { paths: ['/user/skills'] });
});

test('each fresh model request receives one complete ruleset', async () => {
  const hooks = await loadPlugin({});
  const { getInstructions } = require('../hooks/agile-core');
  for (let request = 0; request < 3; request++) {
    const system = await transform(hooks);
    assert.deepEqual(system, [getInstructions()]);
  }
});

test('parseCommandFile reads frontmatter description + body, LF and CRLF', () => {
  const lf = path.join(tmp, 'cmd-lf.md');
  fs.writeFileSync(lf, '---\ndescription: do a thing\n---\n\nthe template body\n');
  assert.deepEqual(parseCommandFile(lf), { description: 'do a thing', template: 'the template body' });

  const crlf = path.join(tmp, 'cmd-crlf.md');
  fs.writeFileSync(crlf, '---\r\ndescription: do a thing\r\n---\r\n\r\nthe template body\r\n');
  assert.deepEqual(parseCommandFile(crlf), { description: 'do a thing', template: 'the template body' });
});

test('parseCommandFile returns null when there is no frontmatter', () => {
  const bare = path.join(tmp, 'cmd-bare.md');
  fs.writeFileSync(bare, 'no frontmatter here\n');
  assert.equal(parseCommandFile(bare), null);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
