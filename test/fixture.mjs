import {createServer} from 'node:http';
export async function startFixture() {
  const server=createServer((req,res)=>{
    if(req.url==='/download') {res.writeHead(200,{'Content-Type':'text/plain','Content-Disposition':'attachment; filename="example.txt"'});res.end('browser test download');return;}
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!doctype html><html><title>Browser acceptance fixture</title>
<style>body{font:18px sans-serif;margin:24px}canvas{display:block;margin-top:20px;background:#2277cc}label,input,button,a{margin:8px}</style>
<h1>Browser acceptance fixture</h1>
<label>Name <input id="name"></label><button id="save">Save draft</button><p id="result">No draft</p>
<a href="/second" target="_blank">Second tab</a><a href="/download">Download sample</a>
<label>Upload sample <input id="upload" type="file"></label><p id="uploaded">No file</p>
<button id="danger">Delete simulated record</button><p id="deleted">Record present</p>
<canvas width="300" height="100"></canvas><p id="visual">Canvas idle</p>
<script>
nameField=document.querySelector('#name');nameField.value=localStorage.draft||'';
document.querySelector('#save').onclick=()=>{localStorage.draft=nameField.value;document.querySelector('#result').textContent='Saved draft: '+nameField.value};
document.querySelector('#upload').onchange=e=>document.querySelector('#uploaded').textContent='Uploaded: '+e.target.files[0].name;
document.querySelector('canvas').onclick=()=>document.querySelector('#visual').textContent='Canvas clicked';
document.querySelector('#danger').onclick=()=>{if(confirm('Delete simulated record?'))document.querySelector('#deleted').textContent='Record deleted'};
</script></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const {url}=await startFixture();console.log(url);}
