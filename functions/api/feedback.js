// /api/feedback — 線上回報 API（Cloudflare Pages Functions＋D1）
// POST：夥伴回報寫入 D1（欄位長度上限、prepared statement）
// GET ?token=&since=：管理者增量拉取（JSONL；token 比對 env.ADMIN_TOKEN）
// 綁定需求：D1 binding 變數名 DB＋Secret ADMIN_TOKEN（Pages 專案 Settings）

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ ok: false, err: 'no-binding' }, 500);
    const raw = await request.text();
    if (raw.length > 8192) return json({ ok: false, err: 'too-large' }, 413);
    let b;
    try { b = JSON.parse(raw); } catch (e) { return json({ ok: false, err: 'bad-json' }, 400); }
    const f = (v, n) => String(v == null ? '' : v).slice(0, n);
    const rec = {
      ts: f(b.ts, 40), id: f(b.id, 40), block: f(b.block, 60), path: f(b.path, 200),
      before: f(b.before, 2000), after: f(b.after, 2000), note: f(b.note, 2000),
      reporter: f(b.reporter, 60),
    };
    if (!rec.id || (!rec.note && !rec.after)) return json({ ok: false, err: 'empty' }, 400);
    await env.DB.prepare(
      'INSERT INTO feedback (ts,id,block,path,before,after,note,reporter) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(rec.ts, rec.id, rec.block, rec.path, rec.before, rec.after, rec.note, rec.reporter).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, err: 'server' }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response('unauthorized', { status: 401 });
  }
  if (!env.DB) return new Response('no-binding', { status: 500 });
  const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
  const rs = await env.DB.prepare(
    'SELECT * FROM feedback WHERE fid > ? ORDER BY fid LIMIT 500'
  ).bind(since).all();
  const lines = (rs.results || []).map(r => JSON.stringify(r)).join('\n');
  return new Response(lines, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
  });
}
