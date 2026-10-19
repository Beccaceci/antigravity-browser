import { readFile, mkdir, writeFile, rename, copyFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
export const serverName = 'antigravity-browser';
type Config = { mcpServers?: Record<string, unknown>; [key: string]: unknown };
export async function readConfig(path: string): Promise<Config> {
  let raw: string;
  try { raw = await readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error(`Invalid JSON in ${path}; configuration was not changed.`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('MCP configuration must be an object.');
  const config = value as Config;
  if (config.mcpServers !== undefined && (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers))) throw new Error('mcpServers must be an object.');
  return config;
}
export async function updateConfig(path: string, entry?: unknown): Promise<{changed: boolean; backup?: string}> {
  const config = await readConfig(path);
  const servers = { ...config.mcpServers };
  if (entry === undefined) {
    if (!(serverName in servers)) return { changed: false };
    delete servers[serverName];
  } else {
    if (JSON.stringify(servers[serverName]) === JSON.stringify(entry)) return { changed: false };
    if (serverName in servers) throw new Error('An entry with this name already exists and differs. Remove it explicitly before reinstalling.');
    servers[serverName] = entry;
  }
  await mkdir(dirname(path), {recursive: true, mode: 0o700});
  let backup: string | undefined;
  let mode = 0o600;
  try {
    mode = (await stat(path)).mode & 0o777;
    backup = `${path}.backup-${Date.now()}-${process.pid}`;
    await copyFile(path, backup);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, JSON.stringify({...config, mcpServers: servers}, null, 2) + '\n', {mode});
  await rename(temp, path);
  return {changed: true, backup};
}
