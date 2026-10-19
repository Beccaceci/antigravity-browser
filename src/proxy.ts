import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListRootsRequestSchema, ToolListChangedNotificationSchema, RootsListChangedNotificationSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { OutputStore } from './output.js';
const readTool = {
  name:'browser_read_output',
  description:'Read a small page of saved oversized tool output. Use its output ID and next offset. For current page elements prefer browser_find; saved references may be stale.',
  inputSchema:{type:'object' as const,properties:{id:{type:'string'},offset:{type:'integer',minimum:0,default:0},limit:{type:'integer',minimum:1,maximum:6000,default:4000}},required:['id']},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
};
export async function runProxy(args: string[], directory: string, compact: boolean) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => !key.startsWith('PLAYWRIGHT_MCP_') && value !== undefined)) as Record<string,string>;
  const upstreamTransport = new StdioClientTransport({command:process.execPath,args,env,stderr:'inherit'});
  const upstream = new Client({name:'antigravity-browser',version:'0.1.0'},{capabilities:{roots:{listChanged:true}}});
  const server = new Server({name:'antigravity-browser',version:'0.1.0'},{capabilities:{tools:{listChanged:true}}});
  const store = new OutputStore(directory);
  upstream.setRequestHandler(ListRootsRequestSchema, async () => {
    if (!server.getClientCapabilities()?.roots) return {roots:[]};
    return server.listRoots();
  });
  upstream.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
    if (server.transport) await server.notification({method:'notifications/tools/list_changed'});
  });
  server.setRequestHandler(ListToolsRequestSchema, async request => {
    const result = await upstream.listTools(request.params);
    return {...result,tools:[...result.tools,...(!result.nextCursor ? [readTool] : [])]};
  });
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    if (request.params.name === readTool.name) {
      try {
        const a = request.params.arguments ?? {};
        return await store.read(a.id as string, a.offset as number | undefined, a.limit as number | undefined);
      } catch (error) {return {isError:true,content:[{type:'text',text:(error as Error).message}]};}
    }
    const result = await upstream.callTool(request.params, undefined, {signal:extra.signal}) as CallToolResult;
    return compact ? store.bound(result) : result;
  });
  // Propagate changed workspace roots so uploads keep the original client's file scope.
  server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
    await upstream.notification({method:'notifications/roots/list_changed'});
  });
  let finish!: () => void;
  const ended = new Promise<void>(resolve => {finish=resolve;});
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    try {await server.close();} finally {
      try {await upstream.close();} finally {await upstreamTransport.close();finish();}
    }
  };
  server.onclose = () => {void close();};
  upstream.onclose = () => {void close();};
  const stop = () => {void close();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);process.stdin.once('end',stop);
  try {
    await upstream.connect(upstreamTransport,{timeout:15000});
    await server.connect(new StdioServerTransport());
    await ended;
  } finally {
    process.off('SIGTERM',stop);process.off('SIGINT',stop);process.stdin.off('end',stop);
    await close();
  }
}
