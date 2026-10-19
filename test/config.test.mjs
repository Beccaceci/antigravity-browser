import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {updateConfig} from '../dist/config.js';
test('installation is idempotent, preserves existing config, backs up, and removes only our entry', async () => {
  const dir=await mkdtemp(join(tmpdir(),'ag-config-'));
  try {
    const path=join(dir,'mcp.json');
    const original={other:{enabled:true},mcpServers:{rea:{command:'/existing/rea'}}};
    await writeFile(path,JSON.stringify(original));
    const entry={command:'/absolute/node',args:['/absolute/cli','serve']};
    const installed=await updateConfig(path,entry);
    assert.deepEqual(JSON.parse(await readFile(installed.backup,'utf8')),original);
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')).mcpServers.rea,original.mcpServers.rea);
    assert.equal((await updateConfig(path,entry)).changed,false);
    await assert.rejects(updateConfig(path,{command:'different'}),/already exists/);
    assert.equal((await updateConfig(path)).changed,true);
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),original);
    assert.equal((await updateConfig(path)).changed,false);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('invalid configuration is never overwritten; new configuration can be created', async () => {
  const dir=await mkdtemp(join(tmpdir(),'ag-invalid-'));
  try {
    const path=join(dir,'config.json');
    for(const raw of ['{broken','[]','{"mcpServers":null}','{"mcpServers":[]}']) {
      await writeFile(path,raw);
      await assert.rejects(updateConfig(path,{command:'node'}));
      assert.equal(await readFile(path,'utf8'),raw);
    }
    const fresh=join(dir,'nested/config.json');
    assert.equal((await updateConfig(fresh,{command:'node'})).changed,true);
  } finally {await rm(dir,{recursive:true,force:true});}
});
