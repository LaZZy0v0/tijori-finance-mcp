/**
 * Tijori Finance MCP — Interactive Setup Wizard
 *
 * Guides you through:
 *   1. Saving your Tijori credentials
 *   2. Installing Node packages + Chromium
 *   3. Authenticating with Tijori Finance
 *   4. Auto-configuring Claude Desktop
 *
 * Usage: node setup.js
 */

import { createInterface } from 'readline/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Terminal helpers ──────────────────────────────────────────────────────────

const bold  = s => `\x1b[1m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const red   = s => `\x1b[31m${s}\x1b[0m`;

function print(msg = '') { process.stdout.write(msg + '\n'); }
function step(n, msg)    { print(`\n${bold(`[${n}]`)} ${bold(msg)}`); }
function ok(msg)         { print(`   ${green('✓')} ${msg}`); }
function warn(msg)       { print(`   ${yellow('!')} ${msg}`); }

// ── Main ──────────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });

print('');
print(bold('  Tijori Finance MCP — Setup'));
print('  ─────────────────────────────────────────');
print('  This wizard will configure everything in ~5 minutes.');

// ── Step 1: Credentials ───────────────────────────────────────────────────────

step('1/4', 'Tijori Finance credentials');

const envPath = join(__dirname, '.env');

let email, password, useExisting = false;

if (existsSync(envPath)) {
  const existing = readFileSync(envPath, 'utf-8');
  const emailMatch = existing.match(/TIJORI_EMAIL=(.+)/);
  const passMatch  = existing.match(/TIJORI_PASSWORD=(.+)/);
  if (
    emailMatch && passMatch &&
    emailMatch[1].trim() !== 'your@email.com' &&
    emailMatch[1].trim() !== ''
  ) {
    email    = emailMatch[1].trim();
    password = passMatch[1].trim();
    print(`   Found saved credentials: ${email}`);
    const ans = await rl.question('   Use these? (Y/n): ');
    useExisting = !ans.trim() || ans.trim().toLowerCase() === 'y';
  }
}

if (!useExisting) {
  print('   Enter your Tijori Finance login details.');
  print(`   (Sign up free at ${bold('https://tijorifinance.com')} if you don\'t have an account)`);
  print('');
  email    = await rl.question('   Email:    ');
  password = await rl.question('   Password: ');

  if (!email.includes('@') || !password) {
    print(red('\n   Invalid credentials — please re-run setup.'));
    process.exit(1);
  }

  writeFileSync(envPath, `TIJORI_EMAIL=${email}\nTIJORI_PASSWORD=${password}\n`);
  ok('.env saved');
}

rl.close();

// ── Step 2: Install dependencies ──────────────────────────────────────────────

step('2/4', 'Installing dependencies');

print('   Installing Node packages...');
try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  ok('npm packages installed');
} catch {
  print(red('\n   npm install failed. Is Node.js 18+ installed? https://nodejs.org'));
  process.exit(1);
}

print('\n   Downloading Chromium browser (~150 MB, one-time only)...');
try {
  execSync('npx playwright install chromium', { stdio: 'inherit', cwd: __dirname });
  ok('Chromium ready');
} catch {
  print(red('\n   Chromium download failed. Check your internet connection and retry.'));
  process.exit(1);
}

// ── Step 3: Authenticate ──────────────────────────────────────────────────────

step('3/4', 'Authenticating with Tijori Finance');
print('   A browser window will open. Log in to your Tijori Finance account.');
print('   The window closes automatically once you are logged in.');
print('   (You have 3 minutes)\n');

try {
  execSync('node discover.js', { stdio: 'inherit', cwd: __dirname });
  ok('Session saved — you won\'t need to log in again unless the session expires');
} catch {
  warn('Authentication may have failed. Run "npm run reauth" later if tools stop working.');
}

// ── Step 4: Configure Claude Desktop ─────────────────────────────────────────

step('4/4', 'Configuring Claude Desktop');

// Build the absolute path to the MCP server entry point
const indexPath = resolve(__dirname, 'src', 'index.js').split('\\').join('/');

const mcpEntry = { command: 'node', args: [indexPath] };

// Find Claude Desktop config file
let configPath;
if (process.platform === 'win32') {
  configPath = join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
} else if (process.platform === 'darwin') {
  configPath = join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
} else {
  configPath = join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

if (!existsSync(configPath)) {
  warn(`Claude Desktop config not found at:`);
  warn(`  ${configPath}`);
  print('');
  print('   Is Claude Desktop installed? Download from: https://claude.ai/download');
  print('   Once installed, add this block to the config file and restart Claude:');
  print('');
  print('   ' + JSON.stringify({ mcpServers: { 'tijori-finance': mcpEntry } }, null, 4)
    .split('\n').join('\n   '));
} else {
  let config = {};
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    // config file exists but is empty or malformed — start fresh
  }
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers['tijori-finance'] = mcpEntry;

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  ok(`Claude Desktop configured`);
  print(`   Config: ${configPath}`);
}

// ── Done ──────────────────────────────────────────────────────────────────────

print('');
print(green(bold('  ✓ Setup complete!')));
print('');
print('  Next steps:');
print('  1. Fully quit Claude Desktop (Cmd+Q / right-click taskbar → Quit)');
print('  2. Reopen Claude Desktop');
print('  3. Try: "Search Tata Steel using Tijori MCP"');
print('');
print(`  If tools stop working later, run: ${bold('npm run reauth')}`);
print('');
