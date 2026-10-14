(function () {
  const g = globalThis;
  if (g.__busytexSplitFetch) return;
  g.__busytexSplitFetch = true;
  const PARTS = { 'texlive-extra.data': 4, 'texlive-recommended.data': 3 };
  const origFetch = g.fetch.bind(g);
  g.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const clean = url.split('?')[0].split('#')[0];
    const name = clean.substring(clean.lastIndexOf('/') + 1);
    const n = PARTS[name];
    if (!n) return origFetch(input, init);
    return (async () => {
      const urls = Array.from({ length: n }, (_, i) => clean + '.part-' + String(i).padStart(2, '0'));
      let total = 0;
      try {
        const heads = await Promise.all(urls.map((u) => origFetch(u, { method: 'HEAD' })));
        total = heads.reduce((s, r) => s + (parseInt(r.headers.get('Content-Length'), 10) || 0), 0);
      } catch (e) {}
      let i = 0, reader = null;
      const stream = new ReadableStream({
        async pull(controller) {
          while (true) {
            if (!reader) {
              if (i >= urls.length) { controller.close(); return; }
              const r = await origFetch(urls[i++]);
              if (!r.ok) throw new Error('Failed to fetch ' + urls[i - 1] + ' (' + r.status + ')');
              reader = r.body.getReader();
            }
            const { done, value } = await reader.read();
            if (done) { reader = null; continue; }
            controller.enqueue(value);
            return;
          }
        }
      });
      const headers = { 'Content-Type': 'application/octet-stream' };
      if (total) headers['Content-Length'] = String(total);
      return new Response(stream, { status: 200, headers });
    })();
  };
})();
