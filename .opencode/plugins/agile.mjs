// agile — OpenCode plugin.
//
// Injects the agile ruleset into every chat's system prompt, persists
// /agile off (and turns it back on), and registers the /agile command so
// it works when the package is installed from npm. Reuses the shared
// instruction builder so Claude Code, Codex, and OpenCode all read one
// source of truth.
//
// OpenCode loads this as a server plugin — add it to your opencode.json:
//   { "plugin": ["@hubertlepicki/agile"] }

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);
const { DEACTIVATE, REACTIVATE, getInstructions } = require('../../hooks/agile-core');
const { parseCommandFile } = require('./agile-frontmatter.cjs');

const flagPath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.agile-off',
);

function isActive() {
  return !fs.existsSync(flagPath);
}

function deactivate() {
  try {
    fs.mkdirSync(path.dirname(flagPath), { recursive: true });
    fs.writeFileSync(flagPath, '');
  } catch (e) {}
}

function activate() {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

export default async () => {
  // A new OpenCode process is a new session: start on, like Claude SessionStart.
  activate();

  return {
    config: async (config) => {
      if (!config.command) config.command = {};
      const commandDir = path.join(__dirname, '..', 'command');
      try {
        for (const file of fs.readdirSync(commandDir).filter((f) => f.endsWith('.md'))) {
          const name = path.basename(file, '.md');
          const parsed = parseCommandFile(path.join(commandDir, file));
          if (parsed) config.command[name] = parsed;
        }
      } catch (e) {}
    },

    'experimental.chat.system.transform': async (_input, output) => {
      if (!isActive()) return;
      const instructions = getInstructions();
      if (output.system.length > 0) {
        output.system[output.system.length - 1] += '\n\n' + instructions;
      } else {
        output.system.push(instructions);
      }
    },

    'command.execute.before': async (input) => {
      if (!input || input.command !== 'agile') return;
      const args = String(input.arguments || '').trim();
      const slash = '/agile' + (args ? ' ' + args : '');
      if (DEACTIVATE.test(slash) || DEACTIVATE.test(args)) {
        deactivate();
        return;
      }
      if (REACTIVATE.test(slash) || REACTIVATE.test(args)) {
        activate();
      }
    },
  };
};
