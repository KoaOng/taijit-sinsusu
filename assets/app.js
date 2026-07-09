// app.js — 搜尋頁（PLAN_WEBSITE W1.5：調號搜尋／POJ 輸入式／條目編號）
// 依賴：assets/poj_converter.js 需先載入（parsePoj 單一真相＝review_live 版，build 自動同步）
// 索引欄位見 export_site_data.py：id/kanji/kana/kana_norm/poj/poj_ascii/poj_plain/summary/status/page/seg
'use strict';

/* ══════════ 純函數（node 可測；勿在此區碰 DOM） ══════════ */

function hira2kata(s) {
  return s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function stripDia(s) {
  return s.normalize('NFD').replace(/[̀-ͯ͘]/g, '')
          .replace(/ⁿ/g, 'n').toLowerCase();
}
function normKanaQ(s) {
  return hira2kata(s).replace(/[·̄̅\s0-9a-zA-Z\-ー]/g, '');
}
function hasCJK(s) { return /[㐀-鿿豈-﫿□々]/.test(s); }
function hasKana(s) { return /[ぁ-ゖァ-ヺ]/.test(s); }
function hasLatinLoose(s) { return /[a-z]/.test(stripDia(s)); }   // á â ā a̍ 也算拉丁輸入

// ── POJ token 正規化（查詢與索引共用同一條路） ──
const TONE_MARK_RE = /[́̀̂̄̍̋̆̌]/;

function canonTok(raw) {
  let s = (raw || '').trim();
  if (!s) return null;
  const hasDigit = /[1-8]/.test(s);
  const hasMark = TONE_MARK_RE.test(s.normalize('NFD'));
  s = s.replace(/([1-8])(nn|ⁿ)$/i, '$2$1');         // a3nn → ann3（數字位置容錯）
  let p = null;
  try { p = parsePoj(s); } catch (e) { p = null; }
  if (!p) return null;
  const body = p.onset + p.vowels.join('') + p.final;
  if (!body) return null;
  return { body: body, tone: (hasDigit || hasMark) ? p.tone : 0,
           nasal: !!p.nasal, expl: (hasDigit || hasMark) };
}
function canonToks(str) {
  return String(str || '').split(/[-\s]+/).map(canonTok).filter(Boolean);
}

// token 比對：2=同調（strict）、1=異調（body 同、調或鼻音異）、0=不合
function tokMatch(q, t) {
  if (q.body !== t.body) return 0;
  const toneOK = (q.tone === 0) || (q.tone === t.tone);
  const nasalOK = (q.nasal === t.nasal) || (!q.nasal && !q.expl);
  return (toneOK && nasalOK) ? 2 : 1;
}

// 連續 token 子序列比對 → {kind:'strict'|'loose', at} | null
function seqMatch(qToks, iToks) {
  if (!qToks.length || !iToks.length || qToks.length > iToks.length) return null;
  let loose = null;
  for (let st = 0; st + qToks.length <= iToks.length; st++) {
    let min = 2;
    for (let k = 0; k < qToks.length; k++) {
      const m = tokMatch(qToks[k], iToks[st + k]);
      if (m === 0) { min = 0; break; }
      if (m < min) min = m;
    }
    if (min === 2) return { kind: 'strict', at: st };
    if (min === 1 && !loose) loose = { kind: 'loose', at: st };
  }
  return loose;
}

// ── 條目編號查詢 ──
// 規則：有 p 前綴＝掃描頁（p0052-1-01；p52 亦可）；無 p＝書頁，自動 +51 換算
//（0001-上-01／0001-1-01／0001 → p0052…）。段可用 123 或 上中下；序可不補零。
// 純數字無段序時須 ≥3 位（避免打字途中誤觸發）。
const SEGMAP = { '上': '1', '中': '2', '下': '3' };
function parseIdQuery(qRaw) {
  const s = qRaw.trim();
  let m = s.match(/^p(\d{1,4})(?:-([123上中下]))?(?:-(\d{1,3}))?$/i);
  let page;
  if (m) {
    page = m[1].padStart(4, '0');                                   // 掃描頁
  } else {
    m = s.match(/^(\d{1,4})(?:-([123上中下]))?(?:-(\d{1,3}))?$/);   // 書頁 → +51
    if (!m) return null;
    if (!m[2] && !m[3] && m[1].length < 3) return null;
    page = String(parseInt(m[1], 10) + 51).padStart(4, '0');
  }
  const seg = m[2] ? (SEGMAP[m[2]] || m[2]) : null;
  const num = m[3] || null;
  let prefix = 'p' + page;
  if (seg) {
    prefix += '-' + seg;
    if (num) prefix += '-' + num.padStart(2, '0');
  }
  return { full: !!(seg && num), prefix: prefix };
}

// ── 查詢上下文（每次輸入算一次） ──
function buildQueryCtx(qRaw) {
  const q = qRaw.trim();
  const ctx = { q: q, idQ: null, cjk: false, kana: false, latin: false,
                qk: '', qplain: '', qToks: [], toned: false };
  if (!q) return ctx;
  ctx.idQ = parseIdQuery(q);
  ctx.cjk = hasCJK(q);
  ctx.kana = hasKana(q);
  ctx.latin = hasLatinLoose(q);
  if (ctx.kana) ctx.qk = normKanaQ(q);
  if (ctx.latin) {
    ctx.qplain = stripDia(q).replace(/[^a-z]/g, '');
    ctx.qToks = canonToks(q);
    ctx.toned = ctx.qToks.length > 0 && ctx.qToks.some(t => t.expl);
  }
  return ctx;
}

// 索引條目快取 token
function entryToks(e) {
  if (!e._toks) e._toks = canonToks(e.poj_ascii || '');
  return e._toks;
}

// ── 主比對：回 {tier, other} | null ──
// tier：7=編號全中、6=編號前綴、5=精確、4=起首、3=包含、1=異調
function matchEntry(e, ctx, mode) {
  if (!ctx.q) return null;
  if (ctx.idQ) {
    if (ctx.idQ.full && e.id === ctx.idQ.prefix) return { tier: 7, other: false };
    if (!ctx.idQ.full && e.id.startsWith(ctx.idQ.prefix)) return { tier: 6, other: false };
    return null;                                    // 編號型查詢不混其他比對
  }
  const qlow = ctx.q.toLowerCase();

  if (mode === 'exact') {
    if (ctx.cjk && e.kanji === ctx.q) return { tier: 5, other: false };
    if (ctx.kana && ctx.qk) {
      const kq = hira2kata(ctx.q).replace(/\s/g, '');
      if (e.kana.replace(/\s/g, '') === kq) return { tier: 5, other: false };
      if (!/[1-8]/.test(kq) && e.kana_norm === ctx.qk) return { tier: 5, other: false };
    }
    if (ctx.latin) {
      if (ctx.toned) {
        const it = entryToks(e);
        if (it.length === ctx.qToks.length) {
          const r = seqMatch(ctx.qToks, it);
          if (r && r.kind === 'strict' && r.at === 0) return { tier: 5, other: false };
        }
      } else {
        if (e.poj.normalize('NFC') === qlow.normalize('NFC') ||
            stripDia(e.poj).replace(/-/g, '') === stripDia(qlow).replace(/-/g, '')) {
          return { tier: 5, other: false };
        }
      }
    }
    return null;
  }

  // fuzzy
  let best = null;
  const take = (tier, other) => {
    if (!best || tier > best.tier) best = { tier: tier, other: !!other };
  };
  if (ctx.cjk) {
    if (e.kanji.startsWith(ctx.q)) take(4);
    else if (e.kanji.includes(ctx.q)) take(3);
  }
  if (ctx.kana && ctx.qk) {
    if (e.kana_norm.startsWith(ctx.qk)) take(4);
    else if (e.kana_norm.includes(ctx.qk)) take(3);
  }
  if (ctx.latin) {
    if (ctx.toned) {
      const r = seqMatch(ctx.qToks, entryToks(e));
      if (r) {
        if (r.kind === 'strict') take(r.at === 0 ? 4 : 3);
        else take(1, true);
      }
    } else if (ctx.qplain) {
      if (e.poj_plain.startsWith(ctx.qplain)) take(4);
      else if (e.poj_plain.includes(ctx.qplain)) take(3);
    }
  }
  return best;
}

/* ══════════ 以下 DOM（瀏覽器限定） ══════════ */

if (typeof document !== 'undefined') {

  let INDEX = [];
  let META = {};
  let mode = 'fuzzy';
  let timer = null;

  const $q = s => document.querySelector(s);

  const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const render = (list, ctx) => {
    const ul = $q('#results');
    const st = $q('#stats');
    ul.innerHTML = '';
    if (!ctx.q) {
      st.textContent = META.total
        ? `收錄 ${META.total} 條（完整 ${META.complete}・建置中 ${META.skeleton}）` : '';
      return;
    }
    if (!list.length) {
      st.textContent = '查無結果';
      const li = document.createElement('li');
      li.className = 'hint';
      li.innerHTML = '查無結果。可以試試：改用<b>模糊</b>模式、拿掉調號（如 a 代替 á）、' +
        '檢查輸入式（a5＝â、ann3＝àⁿ、oo2＝ó͘）、或用條目編號（如 p0052-1-01）。';
      ul.appendChild(li);
      return;
    }
    const nStrict = list.filter(x => !x.m.other).length;
    const nOther = list.length - nStrict;
    st.textContent = ctx.toned
      ? `找到 ${list.length} 條（同調 ${nStrict}・異調 ${nOther}）`
      : `找到 ${list.length} 條`;
    const frag = document.createDocumentFragment();
    for (const hit of list.slice(0, 200)) {
      const e = hit.e, m = hit.m;
      const li = document.createElement('li');
      const skel = e.status === 'skeleton';
      li.innerHTML =
        `<a class="row${m.other ? ' othertone' : ''}" href="entry.html?id=${encodeURIComponent(e.id)}">` +
        `<span class="hz">${escH(e.kanji)}</span>` +
        `<span class="kn">${escH(e.kana)}</span>` +
        `<span class="pj">${escH(e.poj)}</span>` +
        (m.other ? '<span class="badge other">異調</span>' : '') +
        (skel ? '<span class="badge skel">內容建置中</span>'
              : '<span class="badge">完整</span>') +
        (skel || !e.summary ? '' : `<span class="sm">${escH(e.summary)}</span>`) +
        '</a>';
      frag.appendChild(li);
    }
    ul.appendChild(frag);
    if (list.length > 200) {
      const li = document.createElement('li');
      li.className = 'hint';
      li.textContent = '僅顯示前 200 條，請縮小關鍵字。';
      ul.appendChild(li);
    }
  };

  const doSearch = () => {
    const ctx = buildQueryCtx($q('#q').value);
    const hits = [];
    for (const e of INDEX) {
      const m = matchEntry(e, ctx, mode);
      if (m) hits.push({ e: e, m: m });
    }
    hits.sort((a, b) => b.m.tier - a.m.tier);       // 同 tier 保持冊序
    render(hits, ctx);
  };

  const init = async () => {
    try {
      const rs = await Promise.all([fetch('data/index.json'), fetch('data/meta.json')]);
      INDEX = (await rs[0].json()).entries;
      META = await rs[1].json();
    } catch (e) {
      $q('#stats').textContent = '索引載入失敗（請經由本機伺服器開啟，不能直接雙擊檔案）';
      return;
    }
    $q('#stats').textContent =
      `收錄 ${META.total} 條（完整 ${META.complete}・建置中 ${META.skeleton}）` +
      `・資料版本 ${META.generated}`;
    $q('#q').addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(doSearch, 150);
    });
    $q('#q').addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        const first = document.querySelector('#results a.row');
        if (first) location.href = first.getAttribute('href');
      }
    });
    document.querySelectorAll('.mode button').forEach(b => {
      b.addEventListener('click', () => {
        mode = b.dataset.mode;
        document.querySelectorAll('.mode button').forEach(x =>
          x.classList.toggle('on', x === b));
        doSearch();
      });
    });
    const params = new URLSearchParams(location.search);
    if (params.get('q')) { $q('#q').value = params.get('q'); doSearch(); }
    $q('#q').focus();
  };
  document.addEventListener('DOMContentLoaded', init);
}

/* node 測試掛鉤 */
if (typeof globalThis !== 'undefined') {
  globalThis.__searchTest = { canonTok: canonTok, canonToks: canonToks, tokMatch: tokMatch,
                              seqMatch: seqMatch, parseIdQuery: parseIdQuery,
                              buildQueryCtx: buildQueryCtx, matchEntry: matchEntry,
                              stripDia: stripDia };
}
