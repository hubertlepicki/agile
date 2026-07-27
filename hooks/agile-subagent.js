#!/usr/bin/env node
// SubagentStart — SessionStart context never reaches subagents, so delegated
// work would run agile-unaware without this.

const { getInstructions, isActive, writeHookOutput } = require('./agile-core');

if (isActive()) {
  writeHookOutput('SubagentStart', getInstructions());
}
