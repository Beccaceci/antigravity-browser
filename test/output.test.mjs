import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {OutputStore,threshold} from '../dist/output.js';
const text=r=>r.content.filter(b=>b.type==='text').map(b=>b.text).join('');
test('bound oversized text, preserve images/errors, and recover every Unicode code point',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ag-output-'));
  try {
    const store=new OutputStore(dir);
    const original={isError:true,content:[{type:'text',text:'😀'.repeat(6000)},{type:'image',data:'AA==',mimeType:'image/png'},{type:'text',text:'尾'.repeat(6000)}]};
    const bounded=await store.bound(original);
    assert.equal(bounded.isError,true);assert.ok(Array.from(text(bounded)).length<=threshold);
    assert.equal(bounded.content.filter(b=>b.type==='image')[0],original.content[1]);
    assert.ok(text(bounded).startsWith('😀'));assert.match(text(bounded),/Middle omitted/);
    assert.ok(!text(bounded).includes('\uFFFD'));
    const id=text(bounded).match(/"id":"([^"]+)"/)[1];
    assert.equal(await readFile(join(dir,`output-${id}.txt`),'utf8'), '😀'.repeat(6000)+'尾'.repeat(6000));
    const page=await store.read(id,5999,2);assert.ok(text(page).startsWith('😀尾\n'));
    assert.match(text(await store.read(id,11999,10)),/next offset: end/);
    await assert.rejects(store.read('../config',0,1),/Invalid output ID/);
    await assert.rejects(store.read(id,-1,1),/offset/);
    await assert.rejects(store.read(id,0,6001),/limit/);
    await assert.rejects(store.read(id,12001,1),/exceeds/);
    const small={content:[{type:'text',text:'normal error'}],isError:true};
    assert.equal(await store.bound(small),small);
    assert.equal((await readdir(dir)).length,1);
    assert.equal(await new OutputStore(join(dir,'missing')).bound(original),original);
  }finally{await rm(dir,{recursive:true,force:true});}
});
