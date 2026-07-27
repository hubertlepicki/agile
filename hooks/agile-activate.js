#!/usr/bin/env node
// SessionStart — a new session always starts with agile on, so clear any "off"
// left by a previous one, then inject the ruleset.

const { activate, getInstructions, writeHookOutput } = require('./agile-core');

activate();
writeHookOutput('SessionStart', getInstructions());
