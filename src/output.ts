import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
export const threshold = 8192;
const head = 4096;
const tail = 1024;
export class OutputStore {
  constructor(private directory: string) {}
  async bound(result: CallToolResult): Promise<CallToolResult> {
    const blocks = result.content.map(block => block.type === 'text' ? Array.from(block.text) : null);
    const length = blocks.reduce((sum, block) => sum + (block?.length ?? 0), 0);
    if (length <= threshold) return result;
    const id = randomUUID();
    try {
      await writeFile(join(this.directory, `output-${id}.txt`), blocks.filter(block => block !== null).map(block => block.join('')).join(''), {mode: 0o600, flag:'wx'});
    } catch {
      // Never hide information when its recovery copy could not be stored.
      console.error('Could not save oversized browser output; preserving full response.');
      return result;
    }
    const content: CallToolResult['content'] = [];
    let position = 0;
    let marked = false;
    for (let i = 0; i < result.content.length; i++) {
      const block = result.content[i];
      const points = blocks[i];
      if (!points || block.type !== 'text') {content.push(block); continue;}
      const end = position + points.length;
      const prefix = points.slice(0, Math.max(0, Math.min(points.length, head - position))).join('');
      const suffix = points.slice(Math.max(0, length - tail - position)).join('');
      if (prefix) content.push({...block, text:prefix});
      if (!marked && end > head && position < length - tail) {
        content.push({type:'text',text:`\n[Middle omitted: ${length-head-tail} characters. Full text saved.]\n`});
        marked = true;
      }
      if (suffix) content.push({...block, text:suffix});
      position = end;
    }
    content.push({type:'text',text:`\nRecover omitted text with browser_read_output: {"id":"${id}","offset":0,"limit":4000}. Prefer browser_find for current page elements. Offsets count Unicode code points.`});
    return {...result, content};
  }
  async read(id: string, offset = 0, limit = 4000): Promise<CallToolResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('Invalid output ID.');
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 6000) throw new Error('offset must be nonnegative; limit must be 1–6000.');
    const points = Array.from(await readFile(join(this.directory, `output-${id}.txt`), 'utf8'));
    if (offset > points.length) throw new Error('offset exceeds saved output length.');
    const end = Math.min(points.length, offset + limit);
    return {content:[{type:'text',text:points.slice(offset,end).join('') + `\n[${offset}–${end} of ${points.length}; next offset: ${end < points.length ? end : 'end'}]`}]};
  }
}
