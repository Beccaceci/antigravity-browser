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
test('compact output and focused observations reduce text without hiding result or errors',{timeout:150000},async()=>{
  const base=await mkdtemp(join(tmpdir(),'ag-economy-'));
  const {server,url}=await startFixture({large:true});
  async function workflow(mode,focused){
    const transport=new StdioClientTransport({command:process.execPath,args:[resolve('dist/cli.js'),'serve','--data-dir',join(base,mode+(focused?'-focused':'')),'--output-mode',mode],stderr:'pipe'});
    transport.stderr?.on('data',()=>{});
    const client=new Client({name:'economy-test',version:'1'});
    let total=0,actionChars=0;
    async function call(name,args={}){
      const r=await client.callTool({name,arguments:args},undefined,{timeout:30000});
      assert.ok(!r.isError,text(r));total+=chars(r);return r;
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
      const measuredTotal=total;
      if(mode==='compact'){
        assert.doesNotMatch(text(nav),/Ran Playwright code|### Snapshot/);
        const invalid=await client.callTool({name:'browser_click',arguments:{target:'e999999'}});
        assert.equal(invalid.isError,true);assert.match(text(invalid),/error|not found/i);
        const dialog=await call('browser_click',{target:'#danger'});assert.match(text(dialog),/confirm|Delete simulated record/i);
        await call('browser_handle_dialog',{accept:false});
      }
      await call('browser_close');return {total:measuredTotal,actionChars};
    }finally{await client.close();await transport.close();}
  }
  try{
    const full=await workflow('full',false);
    const compact=await workflow('compact',false);
    const focused=await workflow('compact',true);
    assert.ok(compact.actionChars<full.actionChars,JSON.stringify({full,compact}));
    assert.ok(focused.total<full.total*0.3,JSON.stringify({full,focused}));
    console.log(JSON.stringify({measurement:'text characters, not model tokens',full,compact,focused}));
  }finally{await new Promise(resolve=>server.close(resolve));await rm(base,{recursive:true,force:true});}
});
