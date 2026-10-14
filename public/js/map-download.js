// Fetch exposes decoded bytes, so compressed Content-Length is not a valid total.
export async function downloadMap(url, onProgress, fetcher = fetch) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const size = Number(response.headers.get('X-Asset-Size') || (!response.headers.get('Content-Encoding') && response.headers.get('Content-Length')));
  const total = Number.isFinite(size) && size > 0 ? size : 0;
  let loaded = 0;
  onProgress({loaded, total, done:false});
  const chunks = [];
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        chunks.push(value); loaded += value.byteLength;
        onProgress({loaded, total, done:false});
      }
    } finally { reader.releaseLock(); }
  } else {
    const bytes = new Uint8Array(await response.arrayBuffer());
    chunks.push(bytes); loaded = bytes.byteLength;
  }
  if (total && loaded !== total) throw new Error('Incomplete map download. Please retry.');
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  onProgress({loaded, total:loaded, done:true});
  return bytes.buffer;
}

export function downloadLabel(name, {loaded, total, done}) {
  const mb = n => (n / 1048576).toFixed(1);
  if (done) return `${name}: download complete — preparing map…`;
  if (!total) return `Downloading ${name}: ${mb(loaded)} MB received — total size unavailable`;
  const percent = Math.min(99, Math.floor(loaded / total * 100));
  return `Downloading ${name}: ${percent}% · ${mb(loaded)} / ${mb(total)} MB · ${mb(Math.max(0, total-loaded))} MB left (map data)`;
}
