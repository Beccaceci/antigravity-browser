import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readConfig, serverName, updateConfig } from './config.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist/cli.js');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const {positionals, values} = parseArgs({allowPositionals: true, options: {'data-dir': {type:'string'}, config: {type:'string'}}});
const data = resolve(values['data-dir'] ?? join(homedir(), 'Library/Application Support/AntigravityBrowser'));
const configPath = resolve(values.config ?? join(homedir(), '.gemini/config/mcp_config.json'));
const command = positionals[0] ?? 'help';
const upstream = join(root, 'node_modules/@playwright/mcp/cli.js');
const serverArgs = [upstream, '--browser', 'chrome', '--caps', 'vision', '--user-data-dir', join(data, 'profile'), '--output-dir', join(data, 'artifacts')];
async function requirements() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required.');
  await access(chrome).catch(() => {throw new Error('Google Chrome is missing from /Applications.');});
  await access(upstream).catch(() => {throw new Error('Dependencies are missing. Run npm ci.');});
}
async function serve() {
  await requirements();
  await mkdir(data, {recursive: true, mode:0o700});
  const lock = join(data, 'session.lock');
  try { await mkdir(lock, {mode:0o700}); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let owner = 'unknown';
    try {owner = (await readFile(join(lock, 'pid'), 'utf8')).trim();} catch {}
    throw new Error(`Browser session is already locked (PID ${owner}). Close the other conversation's MCP connection. If that process has exited, remove ${lock} manually. No browser processes were terminated.`);
  }
  try {
    await writeFile(join(lock, 'pid'), String(process.pid), {mode:0o600});
    await mkdir(join(data, 'artifacts'), {recursive:true, mode:0o700});
    // CLI settings are explicit; don't inherit upstream behavior flags from a shell.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PLAYWRIGHT_MCP_')));
    const child = spawn(process.execPath, serverArgs, {stdio:'inherit', env});
    const stop = (signal: NodeJS.Signals) => {child.kill(signal);};
    const onTerm = () => stop('SIGTERM');
    const onInt = () => stop('SIGINT');
    process.on('SIGTERM', onTerm); process.on('SIGINT', onInt);
    try {
      const code = await new Promise<number>((accept, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => accept(code ?? (signal ? 1 : 0)));
      });
      process.exitCode = code;
    } finally {process.off('SIGTERM', onTerm); process.off('SIGINT', onInt);}
  } finally {await rm(lock, {recursive:true, force:true});}
}
async function doctor() {
  await requirements();
  const config = await readConfig(configPath);
  console.log(`Node ${process.versions.node}; Chrome found; dependencies found.`);
  console.log(`MCP entry: ${config.mcpServers?.[serverName] ? 'installed' : 'not installed'}; configuration is valid.`);
  const transport = new StdioClientTransport({command:process.execPath,args:[cli,'serve','--data-dir',data],stderr:'pipe'});
  // Consume diagnostics without logging browser/session contents.
  transport.stderr?.on('data', () => {});
  const client = new Client({name:'antigravity-browser-doctor',version:'0.1.0'});
  try {
    await client.connect(transport, {timeout:15000});
    const {tools} = await client.listTools();
    for (const name of ['browser_snapshot','browser_take_screenshot','browser_mouse_click_xy','browser_navigate']) {
      if (!tools.some(tool => tool.name === name)) throw new Error(`Missing required tool: ${name}`);
    }
    console.log(`MCP handshake passed; ${tools.length} tools discovered, including structured and coordinate controls.`);
    console.log('This check does not navigate or verify Gemini behavior.');
  } finally {await client.close(); await transport.close();}
}
try {
  if (command === 'serve') await serve();
  else if (command === 'install') {
    await requirements();
    const result = await updateConfig(configPath, {command:process.execPath,args:[cli,'serve','--data-dir',data]});
    console.log(JSON.stringify(result));
    console.log('Refresh MCP servers in Antigravity. Load instructions/browser.md in the conversation.');
  } else if (command === 'remove') console.log(JSON.stringify(await updateConfig(configPath)));
  else if (command === 'doctor') await doctor();
  else if (command === 'help') console.log('Usage: node dist/cli.js <serve|install|remove|doctor> [--config PATH] [--data-dir PATH]');
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {console.error((error as Error).message); process.exitCode = 1;}
