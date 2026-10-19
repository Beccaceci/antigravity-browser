import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {startFixture} from './fixture.mjs';
const chars=r=>(r.content||[]).filter(c=>c.type==='text').reduce((n,c)=>n+c.text.length,0);
const text=r=>(r.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
async function geminiTokenCount(input,model){
  const key=process.env.GEMINI_API_KEY;
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:countTokens`;
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:input}]}]}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Gemini countTokens failed with HTTP ${response.status}. Check the API key, model, and API access.`);
  const result=await response.json();
  if(!Number.isInteger(result.totalTokens))throw new Error('Gemini countTokens returned no totalTokens value.');
  return result.totalTokens;
}
test('compact output and focused observations reduce text without hiding result or errors',{timeout:150000},async()=>{
  const tokenBenchmark=process.env.GEMINI_TOKEN_BENCHMARK==='1';
  if(tokenBenchmark&&!process.env.GEMINI_API_KEY)throw new Error('Set GEMINI_API_KEY in your shell to run exact token measurement.');
  const tokenModel=process.env.GEMINI_TOKEN_COUNT_MODEL||'gemini-3.8-flash';
  const base=await mkdtemp(join(tmpdir(),'ag-economy-'));
  const {server,url}=await startFixture({large:true});
  async function workflow(mode,focused){
    const transport=new StdioClientTransport({command:process.execPath,args:[resolve('dist/cli.js'),'serve','--data-dir',join(base,mode+(focused?'-focused':'')),'--output-mode',mode],stderr:'pipe'});
    transport.stderr?.on('data',()=>{});
    const client=new Client({name:'economy-test',version:'1'});
    let total=0,actionChars=0,tokenInput='';
    async function call(name,args={}){
      const r=await client.callTool({name,arguments:args},undefined,{timeout:30000});
      assert.ok(!r.isError,text(r));total+=chars(r);tokenInput+=`${text(r)}\n`;return r;
    }
    try{
      await client.connect(transport,{timeout:15000});
      const nav=await call('browser_navigate',{url});actionChars+=chars(nav);
      if(focused) await call('browser_find',{regex:'Name|Save draft'});
      else {
        const observation=await call('browser_snapshot');
        if(mode==='compact') {
          assert.ok(chars(observation)<=8192);
          const id=text(observation).match(/"id":"([^"]+)"/)[1];
          const recovered=await client.callTool({name:'browser_read_output',arguments:{id,offset:0,limit:500}});
          assert.ok(!recovered.isError,text(recovered));assert.match(text(recovered),/Browser acceptance fixture/);
          const denied=await client.callTool({name:'browser_read_output',arguments:{id:'..\/config'}});
          assert.equal(denied.isError,true);
        }
      }
      actionChars+=chars(await call('browser_type',{target:'#name',text:'Economy verified'}));
      actionChars+=chars(await call('browser_click',{target:'#save'}));
      const verified=focused?await call('browser_find',{text:'Saved draft: Economy verified'}):await call('browser_snapshot');
      assert.match(text(verified),/Saved draft: Economy verified/);
      const measuredTotal=total,measuredTokenInput=tokenInput;
      if(mode==='compact'){
        assert.doesNotMatch(text(nav),/Ran Playwright code|### Snapshot/);
        const invalid=await client.callTool({name:'browser_click',arguments:{target:'e999999'}});
        assert.equal(invalid.isError,true);assert.match(text(invalid),/error|not found/i);
        const dialog=await call('browser_click',{target:'#danger'});assert.match(text(dialog),/confirm|Delete simulated record/i);
        await call('browser_handle_dialog',{accept:false});
      }
      await call('browser_close');return {total:measuredTotal,actionChars,tokenInput:measuredTokenInput};
    }finally{await client.close();await transport.close();}
  }
  try{
    const full=await workflow('full',false);
    const compact=await workflow('compact',false);
    const focused=await workflow('compact',true);
    assert.ok(compact.actionChars<full.actionChars,JSON.stringify({full,compact}));
    assert.ok(focused.total<full.total*0.3,JSON.stringify({full,focused}));
    if(tokenBenchmark){
      for(const result of [full,compact,focused])result.geminiInputTokens=await geminiTokenCount(result.tokenInput,tokenModel);
      console.log(JSON.stringify({measurement:`Gemini ${tokenModel} tokens for concatenated synthetic browser tool text only`,full:{total:full.total,actionChars:full.actionChars,geminiInputTokens:full.geminiInputTokens},compact:{total:compact.total,actionChars:compact.actionChars,geminiInputTokens:compact.geminiInputTokens},focused:{total:focused.total,actionChars:focused.actionChars,geminiInputTokens:focused.geminiInputTokens}}));
    }else console.log(JSON.stringify({measurement:'text characters, not model tokens; set GEMINI_TOKEN_BENCHMARK=1 and GEMINI_API_KEY for exact Gemini input token counts',full:{total:full.total,actionChars:full.actionChars},compact:{total:compact.total,actionChars:compact.actionChars},focused:{total:focused.total,actionChars:focused.actionChars}}));
    for(const result of [full,compact,focused])delete result.tokenInput;
  }finally{await new Promise(resolve=>server.close(resolve));await rm(base,{recursive:true,force:true});}
});
