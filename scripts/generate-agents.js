const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'skills/agile/SKILL.md'), 'utf8');
const body = skill.replace(/^---[\s\S]*?\n---\s*/, '').trim();

fs.writeFileSync(path.join(root, 'AGENTS.md'), body + '\n');
