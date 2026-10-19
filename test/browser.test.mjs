import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {startFixture} from './fixture.mjs';
import {ListRootsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {pathToFileURL} from 'node:url';
const cli=resolve('dist/cli.js');
async function connect(data){
  const transport=new StdioClientTransport({command:process.execPath,args:[cli,'serve','--data-dir',data],stderr:'pipe'});
  let stderr='';transport.stderr?.on('data',chunk=>stderr+=chunk);
  const client=new Client({name:'browser-test',version:'1.0'},{capabilities:{roots:{listChanged:true}}});
  client.setRequestHandler(ListRootsRequestSchema,async()=>({roots:[{uri:pathToFileURL(data).href,name:'test workspace'}]}));
  await client.connect(transport,{timeout:20000}).catch(error=>{throw new Error(error.message+' '+stderr)});
  return {client,async close(){try{await client.close()}finally{await transport.close()}}};
}
const text=result=>(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
async function call(client,name,args={}){const result=await client.callTool({name,arguments:args},undefined,{timeout:30000});assert.ok(!result.isError,text(result));return result;}
test('real Chrome: tools, forms, screenshots, visual actions, files, tabs, recovery, persistence, lock', {timeout:150000}, async()=>{
  const data=await mkdtemp(join(tmpdir(),'ag-browser-'));
  const {server,url}=await startFixture();
  let session;
  try {
    session=await connect(data);let client=session.client;
    const names=(await client.listTools()).tools.map(t=>t.name);
    for(const name of ['browser_navigate','browser_snapshot','browser_mouse_click_xy','browser_file_upload','browser_tabs'])assert.ok(names.includes(name),name);
    const navigation=await call(client,'browser_navigate',{url});
    assert.doesNotMatch(text(navigation), /Ran Playwright code|### Snapshot/);
    const focused=await call(client,'browser_find',{regex:'Name|Save draft'});
    assert.match(text(focused), /Name/);
    await call(client,'browser_type',{target:'#name',text:'Gemini acceptance'});
    await call(client,'browser_click',{target:'#save'});
    assert.match(text(await call(client,'browser_snapshot')),/Saved draft: Gemini acceptance/);
    const shot=await call(client,'browser_take_screenshot',{scale:'css'});
    assert.ok(shot.content.some(c=>c.type==='image'),'screenshot reaches model as image content');
    assert.equal(shot.content.filter(c=>c.type==='text').length,0,'image reply omits duplicate text');
    const snapshot=text(await call(client,'browser_snapshot',{boxes:true}));
    // Fixture geometry is measured through the page, independently of accessibility refs.
    const geometry=await call(client,'browser_evaluate',{function:'() => { const b=document.querySelector("canvas").getBoundingClientRect(); return {x:b.x+20,y:b.y+20}; }'});
    const match=text(geometry).match(/"x":\s*([\d.]+),\s*"y":\s*([\d.]+)/);
    assert.ok(match,text(geometry));
    await call(client,'browser_mouse_click_xy',{x:Number(match[1]),y:Number(match[2])});
    assert.match(text(await call(client,'browser_snapshot')),/Canvas clicked/);
    await call(client,'browser_click',{target:'#upload'});
    const upload=join(data,'sample.txt');await writeFile(upload,'upload fixture');
    await call(client,'browser_file_upload',{paths:[upload]});
    assert.match(text(await call(client,'browser_snapshot')),/Uploaded: sample.txt/);
    const download=await call(client,'browser_click',{target:'a[href="/download"]'});
    assert.match(text(download),/download|example.txt/i);
    const files=await readdir(join(data,'artifacts'),{recursive:true});
    const downloaded=files.find(f=>f.endsWith('example.txt'));assert.ok(downloaded,JSON.stringify(files));
    assert.equal(await readFile(join(data,'artifacts',downloaded),'utf8'),'browser test download');
    await call(client,'browser_click',{target:'a[target="_blank"]'});
    assert.match(text(await call(client,'browser_tabs',{action:'list'})),/second/);
    const failed=await client.callTool({name:'browser_click',arguments:{target:'e999999'}});
    assert.equal(failed.isError,true);
    await call(client,'browser_snapshot');
    await call(client,'browser_navigate',{url});
    assert.match(text(await call(client,'browser_snapshot')),/Gemini acceptance/);
    const conflict=spawn(process.execPath,[cli,'serve','--data-dir',data],{stdio:['ignore','pipe','pipe']});
    let diagnostic='';conflict.stderr.on('data',chunk=>diagnostic+=chunk);
    const [code]=await once(conflict,'exit');assert.equal(code,1);assert.match(diagnostic,/already locked/);
    await call(client,'browser_close');await session.close();session=undefined;
    session=await connect(data);client=session.client;
    await call(client,'browser_navigate',{url});
    assert.match(text(await call(client,'browser_snapshot')),/Gemini acceptance/);
    await call(client,'browser_close');
  } finally {
    if(session)await session.close();
    await new Promise(resolve=>server.close(resolve));
    await rm(data,{recursive:true,force:true});
  }
});
