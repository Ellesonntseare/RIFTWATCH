const http = require('http'), fs = require('fs'), path = require('path');
const {attachMultiplayer}=require('./multiplayer-server.cjs');
const root = path.join(__dirname, 'public');
const routes = { '/models/': path.join(__dirname, 'models'), '/vendor/': path.join(__dirname, 'vendor') };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.json':'application/json', '.png':'image/png', '.ogg':'audio/ogg' };
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('Invalid URL'); }
  const prefix = Object.keys(routes).find(p => url.startsWith(p));
  const base = prefix ? routes[prefix] : root;
  const relative = prefix ? url.slice(prefix.length) : url === '/' ? 'index.html' : url.slice(1);
  let file = path.resolve(base, relative);
  const rel = path.relative(base, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end('Forbidden'); }
  // Serve prepared delivery copies without replacing the editable source models.
  let encoding=null;
  if(prefix==='/models/'&&path.extname(file)==='.glb'){
    const webFile=path.join(base,'web',relative);
    if(fs.existsSync(webFile))file=webFile;
    if((req.headers['accept-encoding']||'').split(',').some(part=>/^\s*gzip(?:\s*;|\s*$)/i.test(part)&&!/(?:^|;)\s*q=0(?:\.0*)?\s*$/i.test(part))&&fs.existsSync(file+'.gz')){file+='.gz';encoding='gzip';}
    res.setHeader('Vary','Accept-Encoding');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const etag='"'+st.size.toString(16)+'-'+Math.trunc(st.mtimeMs).toString(16)+'"';
    res.setHeader('Cache-Control',prefix==='/models/'?'public, max-age=86400':'no-cache');
    res.setHeader('ETag',etag);
    if(encoding)res.setHeader('Content-Encoding',encoding);
    if(prefix==='/models/' && (encoding || path.extname(file)==='.glb')) res.setHeader('X-Asset-Size',encoding?fs.statSync(file.slice(0,-3)).size:st.size);
    if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
    res.writeHead(200, { 'Content-Type': mime[encoding?'.glb':path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res);
  });
});
attachMultiplayer(server);
server.listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => console.log('RIFTWATCH + online co-op ready: http://localhost:' + server.address().port));
