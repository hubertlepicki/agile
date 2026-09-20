#!/usr/bin/env node
// Runtime instructions are maintained in the skill and generated into AGENTS.md.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('standalone instructions exactly match the maintained skill body', () => {
  const skill = fs.readFileSync(path.join(root, 'skills/agile/SKILL.md'), 'utf8');
  const body = skill.replace(/^---[\s\S]*?\n---\s*/, '').trim();
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), body + '\n',
    'run npm run generate:agents after editing the skill');
  assert.equal(require('../hooks/agile-core').getInstructions(), 'AGILE MODE ACTIVE\n\n' + body);
});

test('complete instructions and skill discovery stay within their size budgets', () => {
  const instructions = require('../hooks/agile-core').getInstructions();
  const skill = fs.readFileSync(path.join(root, 'skills/agile/SKILL.md'), 'utf8');
  const frontmatter = skill.match(/^---[\s\S]*?\n---/)[0];
  assert.ok(instructions.length <= 4200, `ruleset is ${instructions.length} characters; budget 4200`);
  assert.ok(frontmatter.length <= 400, `frontmatter is ${frontmatter.length} characters; budget 400`);
});

const RULE_COPIES = [
  'GOAL.md',
  'skills/agile/SKILL.md',
  'AGENTS.md',
];

const RULE_INVARIANTS = [
  'conversation, not a ticket',
  'just do it',
  'rule of three',
  'Never fake green',
  'No metaphors',
];

const OFF_PHRASES = [
  'stop agile',
  'normal mode',
  '/agile off',
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\s+/g, ' ');
}

test('GOAL.md, SKILL.md, and AGENTS.md still carry the load-bearing rules', () => {
  for (const rel of RULE_COPIES) {
    const text = read(rel);
    for (const phrase of RULE_INVARIANTS) {
      assert.ok(text.includes(phrase), `${rel} is missing rule invariant: "${phrase}"`);
    }
  }
});

test('SKILL.md, AGENTS.md, and the per-turn reminder name every phrase that turns agile off', () => {
  for (const rel of ['skills/agile/SKILL.md', 'AGENTS.md', 'hooks/agile-core.js']) {
    const text = read(rel);
    for (const phrase of OFF_PHRASES) {
      assert.ok(text.includes(phrase), `${rel} is missing off phrase: "${phrase}"`);
    }
  }
});
