// entry.js — 詳細頁渲染（PLAN_WEBSITE W1.5）
// 三區塊：(a) 現代化對照（POJ＋日文中譯）、(b) 原冊數位化（照印）、(c) 原冊書影 crop
// W1.5：上一條/下一條導覽（鍵盤 ←→）＋本機校對模式（localhost 雙擊編輯→POST /feedback）
// 資料：data/entries/{page}.json（一頁一檔，DESIGN_SEARCH §6.1；entries[id] 取條目，含 prev/next）
'use strict';

const $ = s => document.querySelector(s);
const LOCAL = (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
// 圖床基底（PLAN_WEBSITE 裁決 5／S0）：本機校對走本地 img/（圖床伺服器），
// 線上走 R2 公開網址。R2_BASE 由 S0 部署時填入；空字串＝退回站內 img/（git 圖）。
const R2_BASE = 'https://pub-71b2d9166d2e4a9aa42c76a5f89a94a2.r2.dev/';
const IMG_BASE = (LOCAL || !R2_BASE) ? 'img/' : R2_BASE;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 全 □（殘字）表頭：主位改顯 POJ（2026-07-12 夥伴回饋；與 app.js 同規）
function isBlankKanji(s) {
  s = String(s || '');
  let blank = false;
  for (const ch of s) {
    if (ch === '□') { blank = true; continue; }
    if (ch === '々') continue;
    return false;
  }
  return blank;
}

// 混合缺字：□ 逐位以對應 POJ 音節取代（□□哭 → āuⁿ āuⁿ 哭）；kanji_units＝IDS 感知字位
function mixKanjiParts(units, poj) {
  if (!units || units.indexOf('□') < 0) return null;
  if (units.every(u => u === '□' || u === '々')) return null;
  const syls = String(poj || '').split(/-+/).filter(Boolean);
  if (!syls.length || syls.length !== units.length) return null;
  return units.map((u, i) => u === '□' ? { t: syls[i], pj: true } : { t: u, pj: false });
}
function mixHTML(parts) {
  return parts.map(x => x.pj ? `<span class="pjsub">${esc(x.t)}</span>` : esc(x.t)).join('');
}

// ── ruby 渲染 ───────────────────────────────────────────
function annBox(cls, attr, base, ann) {
  return `<span class="rb ${cls}"${attr}><span class="ann">${ann}</span>${base}</span>`;
}

function rubyOrig(unit) {
  if (!unit.r) return esc(unit.u);
  const r = unit.r;
  let rt = esc(r.k) + (r.tn ? `<sup class="tn">${esc(r.tn)}</sup>` : '');
  let cls = r.lang === 'tw' ? 'tw' : 'jp';
  let attr = '';
  if (r.ed) {
    rt += '*';
    attr = ` title="校訂：${esc(r.ed.corr)}｜${esc(r.ed.note)}"`;
    cls += ' ed';
  }
  return annBox(cls, attr, esc(unit.u), rt);
}

function rubyModern(unit) {
  if (!unit.r) return esc(unit.u);
  const r = unit.r;
  if (r.poj == null) return esc(unit.u);      // 日文振假名：現代區不注（待中譯）
  let rt = esc(r.poj) + (r.star ? '*' : '');
  let attr = '';
  if (r.star) attr = ` title="採校訂值（見原冊區＊註）"`;
  else if (r.uncertain) attr = ` title="原書調記留空，調待考"`;
  const cls = 'poj' + (r.uncertain ? ' unc' : '') + (r.star ? ' ed' : '');
  // 缺字底字：□→POJ 音節（ruby 照印保留；原冊視圖 rubyOrig 不動）
  const base = unit.u === '□' ? `<span class="pjsub">${esc(r.poj)}</span>` : esc(unit.u);
  return annBox(cls, attr, base, rt);
}

function unitsHTML(units, modern) {
  const parts = [];
  for (const u of units || []) {
    let h = modern ? rubyModern(u) : rubyOrig(u);
    if (u.ref) {                           // 註／日釋內參照連結（2026-07-12 夥伴回饋；兩區共標）
      if (parts.length && parts[parts.length - 1] === 'ー') {
        h = parts.pop() + h;               // 前一個裸 ー 併入連結
      }
      h = `<a class="reflink" href="entry.html?id=${encodeURIComponent(u.ref)}" title="前往參照條目">${h}</a>`;
    }
    parts.push(h);
  }
  return parts.join('');
}

function zhHTML(zh, units) {
  // 中譯內台文引用：zh_units 有 poj 的段落渲染 POJ ruby（export parse_zh 產）
  // 帶 ref＝可解析的參照詞 → 超連結（2026-07-12 夥伴回饋）
  if (!units) return esc(zh);
  return units.map(u => {
    if (u.poj == null) return esc(u.t);
    let h = annBox('poj', '', esc(u.t), esc(u.poj));
    if (u.ref) h = `<a class="reflink" href="entry.html?id=${encodeURIComponent(u.ref)}" title="前往參照條目">${h}</a>`;
    return h;
  }).join('');
}

function twModernHTML(items) {
  return (items || []).map(it => {
    if (it.poj == null) return esc(it.u);
    let cls = 'poj' + (it.fromHead ? ' fh' : '') + (it.uncertain ? ' unc' : '');
    let attr = it.fromHead ? ' title="由標頭字補回（原書作ー）"' : '';
    if (it.star) attr = ' title="採校訂值（見原冊區＊註）"';
    if (it.uncertain && !attr) attr = ' title="原書調記留空，調待考"';
    // 缺字底字：□→POJ 音節（ruby 照印保留；2026-07-12 夥伴回饋補充）
    const base = it.u === '□' ? `<span class="pjsub">${esc(it.poj)}</span>` : esc(it.u);
    return annBox(cls, attr, base, esc(it.poj) + (it.star ? '*' : ''));
  }).join('');
}

function headKanaHTML(head) {
  let out = '';
  for (const t of head.kana || []) {
    out += esc(t.k) + (t.tn ? `<sup class="tn">${esc(t.tn)}</sup>` : '');
    if (t.sep === '--') out += '--';
    else if (t.sep) out += ' ';
  }
  return out;
}

const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
function markerOf(sense, i, total) {
  if (sense.marker) return sense.marker;
  return total > 1 ? (CIRC[i] || String(i + 1)) : '';
}

// ── 校對模式：原值萃取（供編輯面板 prefill 與 feedback.before） ──
function textOfUnits(units) {
  return (units || []).map(u => u.u).join('');
}
function rubyDump(units, modern) {
  const parts = [];
  for (const u of units || []) {
    if (!u.r) continue;
    if (modern) {
      if (u.r.poj != null) parts.push(`${u.u}=${u.r.poj}`);
    } else {
      parts.push(`${u.u}=${u.r.k}${u.r.tn || ''}`);
    }
  }
  return parts.join('、');
}
function twModernDump(items) {
  return (items || []).filter(it => it.poj != null)
    .map(it => `${it.u}=${it.poj}`).join('、');
}
function origAttr(text, ruby) {
  const v = ruby ? (text + '\n[注音] ' + ruby) : text;
  return ` data-orig="${esc(v)}"`;
}
function editAttr(path) {
  return LOCAL ? ` data-edit="${esc(path)}"` : '';
}

// ── 三區塊 ──────────────────────────────────────────────
function blockImages(e) {
  const hasCrops = e.crops && e.crops.length;
  if (!hasCrops && !e.page_image) return '';
  const imgs = hasCrops ? e.crops.map(n =>
    `<img src="${IMG_BASE}crops/${esc(n)}.webp" alt="${esc(n)}" loading="lazy" data-zoom="${IMG_BASE}crops/${esc(n)}.webp">`
  ).join('') : '';
  const crossNote = (hasCrops && e.cross)
    ? `<div class="src">（本條目跨${esc(e.cross.to || '段')}，接續欄書影已列於末端）</div>` : '';
  const cropsDesc = (e.crops || []).join('、')
    + (e.cross ? `｜跨${e.cross.to || '段'}接續` : '')
    + `（掃描頁 ${e.page}・第${e.seg_num || ''}排・欄${(e.cols || []).join('–')}）`;
  const proofBtn = (LOCAL && hasCrops)
    ? `<button class="reportbtn proofbtn" data-edit="crops" data-orig="${esc(cropsDesc)}" title="回報切圖問題（缺欄、切偏、順序等）→ 本機佇列">本機校對</button>` : '';
  const locStr = e.seg_num
    ? `掃描頁 ${esc(e.page)}・第${esc(String(e.seg_num))}排 欄${esc((e.cols || []).join('–'))}`
    : `掃描頁 ${esc(e.page)}`;
  return `<section class="card imgcard">
    <h2>原冊書影<button class="reportbtn" data-block="原冊書影">回報錯誤</button>${proofBtn}</h2>
    ${imgs ? `<div class="strips">${imgs}</div>` : ''}${crossNote}
    <div class="tools"><a href="${IMG_BASE}pages/${esc(e.page_image)}.webp" data-zoom="${IMG_BASE}pages/${esc(e.page_image)}.webp">看整頁書影</a>
    　<span class="src">${locStr}</span></div>
    <div class="src">原冊圖檔來源：<a href="https://das.nlpi.edu.tw/" target="_blank" rel="noopener">國立公共資訊圖書館 數位典藏服務網</a></div>
  </section>`;
}

function senseHTML(s, i, total, modern, zhStatus, e) {
  const mk = markerOf(s, i, total);
  const base = `senses[${i}]`;
  let gloss;
  if (!modern) {
    gloss = `<span class="gloss"${editAttr(base + '.gloss')}${origAttr(textOfUnits(s.gloss), rubyDump(s.gloss, false))}>${unitsHTML(s.gloss, false)}</span>`;
  } else if (s.zh) {
    const tag = zhStatus === 'reviewed' ? '' : ' <span class="chip">機器翻譯・待審核</span>';
    gloss = `<span class="zh"${editAttr(base + '.zh')}${origAttr(s.zh, '')}>${zhHTML(s.zh, s.zh_units)}</span>${tag}`;
  } else if ((s.gloss || []).length) {
    gloss = `<span class="pending">中文翻譯建置中——原文暫列：</span>` +
      `<span class="gloss"${editAttr(base + '.gloss_modern')}${origAttr(textOfUnits(s.gloss_modern), rubyDump(s.gloss_modern, true))}>${unitsHTML(s.gloss_modern, true)}</span>`;
  } else {
    gloss = '';                    // 原書無釋義（直接用例，如 百）：不顯示建置中
  }
  const notes = (s.notes || []).map((n, ni) => {
    const useZh = modern && n.zh;               // sense 註中譯疊加（2026-07-09 裁決；比照 refs note_zh）
    const uu = modern ? (n.units_modern || n.units) : n.units;   // 現代化區：台文註帶 POJ（2026-07-11 回饋）
    const body = useZh ? zhHTML(n.zh, n.zh_units) : unitsHTML(uu, modern);
    const orig = useZh ? origAttr(n.zh, '') : origAttr(textOfUnits(uu), rubyDump(uu, modern));
    return `<span class="notein"${editAttr(base + `.notes[${ni}]`)}${orig}>${body}</span>`;
  }).join('');
  // sense 級參照內嵌：refs.senses 對應本義項 marker 者直接放行內（2026-07-11 回饋裁決）
  const inrefs = ((e && e.refs) || []).map((r, ri) => ({ r, ri }))
    .filter(x => x.r.senses && x.r.senses === mk)
    .map(x => {
      const p = refLineInner(x.r, x.ri, modern);
      return `<span class="refin">${p.body}${p.nt}</span>`;
    }).join('');
  const exs = (s.examples || []).map((x, xi) => {
    const ep = base + `.examples[${xi}]`;
    if (!modern) {
      const orig = textOfUnits(x.tw) + '＝' + textOfUnits(x.jp);
      const rb = [rubyDump(x.tw, false), rubyDump(x.jp, false)].filter(Boolean).join('；');
      return `<div class="example"${editAttr(ep)}${origAttr(orig, rb)}><span class="tw">${unitsHTML(x.tw, false)}</span>` +
             `<span class="eqsign">＝</span><span class="jp">${unitsHTML(x.jp, false)}</span></div>`;
    }
    const zh = x.zh
      ? `<span class="zhline">${zhHTML(x.zh, x.zh_units)}</span>`
      : `<span class="pending">翻譯建置中</span>`;
    const orig = textOfUnits(x.tw_modern) + '＝' + (x.zh || '（翻譯建置中）');
    return `<div class="example"${editAttr(ep + '.modern')}${origAttr(orig, twModernDump(x.tw_modern))}><span class="tw">${twModernHTML(x.tw_modern)}</span>` +
           `<span class="eqsign">＝</span>${zh}</div>`;
  }).join('');
  return `<div class="sense">${mk ? `<span class="marker">${esc(mk)}</span>` : ''}${gloss}${notes}${inrefs}${exs}</div>`;
}

function refLineInner(r, ri, modern) {
  const units = modern ? r.kanji_modern : r.kanji;
  let inner = `〔${unitsHTML(units, modern)}〕`;
  if (r.target) {                          // 參照超連結（2026-07-12 夥伴回饋；查無目標不連）
    inner = `<a class="reflink" href="entry.html?id=${encodeURIComponent(r.target)}" title="前往參照條目">${inner}</a>`;
  }
  const body = `＝${inner}`;               // 照印呈現（2026-07-09 fid=3 裁決）
  let nt = '';
  if (modern && r.note_zh) {                         // 參照註中譯（2026-07-09 fid=5 裁決）
    nt = `<span class="src">（${zhHTML(r.note_zh, r.note_zh_units)}）</span>`;
  } else if (r.note) {
    nt = `<span class="src">（${esc(r.note)}）</span>`;
  }
  return { body: `<span${editAttr(`refs[${ri}]`)}${origAttr(textOfUnits(units), rubyDump(units, modern))}>${body}</span>`, nt };
}

function refsHTML(e, modern) {
  if (!e.refs || !e.refs.length) return '';
  const total = (e.senses || []).length;
  const markers = (e.senses || []).map((s, i) => markerOf(s, i, total));
  return e.refs.map((r, ri) => {
    if (r.senses && markers.indexOf(r.senses) >= 0) return '';   // 已內嵌於該義項行（2026-07-11 回饋）
    const p = refLineInner(r, ri, modern);
    const sn = r.senses ? `<span class="chip">${esc(r.senses)}</span>` : '';
    return `<div class="refline"><span class="chip">參照</span>${p.body}${sn}${p.nt}</div>`;
  }).join('');
}

function blockOriginal(e) {
  const total = (e.senses || []).length;
  const senses = (e.senses || []).map((s, i) => senseHTML(s, i, total, false, e.zh_status, e)).join('');
  return `<section class="card" data-blockname="原冊數位化">
    <h2>原冊數位化（照印）<button class="reportbtn" data-block="原冊數位化">回報錯誤</button></h2>
    ${senses}${refsHTML(e, false)}
  </section>`;
}

function blockModern(e) {
  const total = (e.senses || []).length;
  const senses = (e.senses || []).map((s, i) => senseHTML(s, i, total, true, e.zh_status, e)).join('');
  return `<section class="card" data-blockname="現代化對照">
    <h2>現代化對照（POJ＋日文中譯）<button class="reportbtn" data-block="現代化對照">回報錯誤</button></h2>
    ${senses}${refsHTML(e, true)}
  </section>`;
}

function navHTML(e) {
  const prev = e.prev
    ? `<a class="navbtn" id="navprev" href="entry.html?id=${encodeURIComponent(e.prev)}">← 上一條</a>`
    : `<span class="navbtn off">← 上一條</span>`;
  const next = e.next
    ? `<a class="navbtn" id="navnext" href="entry.html?id=${encodeURIComponent(e.next)}">下一條 →</a>`
    : `<span class="navbtn off">下一條 →</span>`;
  return `<span class="nav">${prev}${next}</span>`;
}

function headBar(e) {
  const h = e.head || {};
  const kanjiNote = (h.kanji_notes || []).length
    ? ` <span class="chip" title="${esc(h.kanji_notes.map(n => n.note).join('；'))}">字註</span>` : '';
  const unc = h.poj_uncertain ? '<span class="unc" title="部分調記原書留空">ˀ</span>' : '';
  const kanaTxt = (h.kana || []).map(t => t.k + (t.tn || '') + (t.sep === '--' ? '--' : t.sep ? ' ' : '')).join('');
  const proofChip = LOCAL ? '<span class="chip proof" title="localhost 校對模式：雙擊任何文字段可回報修正">校對模式</span>' : '';
  const skelChip = e.status === 'skeleton'
    ? '<span class="chip skel" title="表頭為機器辨識初稿，尚未精校">建置中</span>' : '';
  const blank = isBlankKanji(h.kanji);   // □ 表頭：POJ 主位、□ 退次要（2026-07-12）
  const hzAttrs = `${editAttr('head')}${origAttr(h.kanji + '｜' + kanaTxt + '｜' + h.poj, '')}`;
  const mix = blank ? null : mixKanjiParts(h.kanji_units, h.poj);
  const hzHTML = blank
    ? `<span class="hz pjhz"${hzAttrs}>${esc(h.poj)}${unc}</span><span class="dimk">${esc(h.kanji)}</span>`
    : `<span class="hz"${hzAttrs}>${mix ? mixHTML(mix) : esc(h.kanji_disp || h.kanji)}</span>`;
  return `<section class="card"><div class="entryhead">
    ${hzHTML}${kanjiNote}
    ${blank ? '' : `<span class="pj">${esc(h.poj)}${unc}</span>`}
    <span class="kn">${headKanaHTML(h)}</span>${skelChip}${proofChip}
    <button class="reportbtn hd" data-block="表頭">回報錯誤</button>
    <span class="loc">${esc(locText(e))}</span>
    ${navHTML(e)}
  </div></section>`;
}

function locText(e) {
  // p0052-1-01（書頁0001・上段・第1條）
  let out = e.id || '';
  const parts = [];
  if (e.page && /^p\d{4}$/.test(e.page)) {
    parts.push('書頁' + String(parseInt(e.page.slice(1), 10) - 51).padStart(4, '0'));
  }
  if (e.seg) parts.push(e.seg + '段');
  const n = (e.id || '').split('-')[2];
  if (n) parts.push('第' + parseInt(n, 10) + '條');
  return parts.length ? `${out}（${parts.join('・')}）` : out;
}

function skeletonNote() {
  return `<section class="card"><p>本條目<strong>資料建置中</strong>——表頭（漢字・假名・POJ）為機器辨識初稿，
  尚未精校；日文釋義、用例與現代化對照將於精校完成後上線。
  下方原冊書影可直接閱讀本條原文；發現表頭錯誤，歡迎按「回報錯誤」告訴我們。</p></section>`;
}

// ── 回報（線上直送 /api/feedback；失敗自動退回複製模式） ──
let reportCtx = '';
let reportBlock = '';
function openReport(block, eid) {
  reportBlock = block;
  reportCtx = `【回報】條目 ${eid}／區塊：${block}`;
  $('#reportctx').textContent = reportCtx;
  $('#reporttext').value = '';
  try { $('#reportname').value = localStorage.getItem('tjss_reporter') || ''; } catch (e) {}
  $('#reportbox').classList.add('on');
}
async function fallbackCopy(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    alert('線上送出暫時不可用，回報內容已複製——請把這段文字用 LINE 或 Email 傳給站主，謝謝！');
  } catch (e) {
    prompt('請手動複製以下回報內容：', txt);
  }
}
async function sendReport(eid) {
  const note = $('#reporttext').value.trim();
  if (!note) { alert('請先描述問題內容。'); return; }
  const reporter = $('#reportname').value.trim();
  try { localStorage.setItem('tjss_reporter', reporter); } catch (e) {}
  const rec = { source: 'online', ts: new Date().toISOString(), id: eid,
                block: reportBlock, note: note, reporter: reporter };
  let ok = false;
  try {
    const r = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    });
    ok = r.ok && (await r.json()).ok === true;
  } catch (e) { ok = false; }
  if (ok) {
    alert('已送出，感謝回報！');
  } else {
    await fallbackCopy(reportCtx + '\n回報者：' + reporter + '\n說明：' + note);
  }
  $('#reportbox').classList.remove('on');
}

// ── 校對模式（localhost；送 bridge_server /feedback） ────
let editTarget = null;
let entryId = '';

function openEdit(el) {
  editTarget = el;
  const path = el.dataset.edit || '';
  const orig = el.dataset.orig || el.textContent;
  $('#editctx').textContent = `條目 ${entryId}／欄位 ${path}`;
  $('#editorig').value = orig;
  $('#editnew').value = orig.split('\n')[0];
  $('#editnote').value = '';
  $('#editbox').classList.add('on');
  $('#editnew').focus();
}

async function submitEdit() {
  if (!editTarget) return;
  const rec = {
    source: 'website',
    ts: new Date().toISOString(),
    id: entryId,
    path: editTarget.dataset.edit || '',
    before: editTarget.dataset.orig || '',
    after: $('#editnew').value.trim(),
    note: $('#editnote').value.trim(),
  };
  try {
    const r = await fetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    });
    if (!r.ok) throw new Error(r.status);
    editTarget.classList.add('edited');
    $('#editbox').classList.remove('on');
  } catch (err) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rec, null, 1));
      alert('無法連到本機伺服器（圖床伺服器.bat 有開嗎？）。修正內容已複製到剪貼簿，請貼回對話。');
    } catch (e2) {
      prompt('無法送出，請手動複製：', JSON.stringify(rec));
    }
  }
}

// ── 初始化 ──────────────────────────────────────────────
async function init() {
  const id = new URLSearchParams(location.search).get('id') || '';
  const root = $('#entry');
  if (!/^[\w\-]+$/.test(id)) { root.innerHTML = '<p class="pending">條目編號不正確。</p>'; return; }
  let e;
  try {
    const page = id.split('-')[0];               // p0052-1-01 → p0052（一頁一檔）
    const r = await fetch(`data/entries/${page}.json`);
    if (!r.ok) throw new Error(r.status);
    e = ((await r.json()).entries || {})[id];
    if (!e) throw new Error('no entry');
  } catch (err) {
    root.innerHTML = '<p class="pending">找不到此條目。</p>';
    return;
  }
  entryId = e.id;
  const tmix = isBlankKanji(e.head.kanji) ? null
    : mixKanjiParts(e.head.kanji_units, e.head.poj);
  document.title = isBlankKanji(e.head.kanji)
    ? `${e.head.poj}・台日新辭書線上版`
    : `${tmix ? tmix.map(x => x.t).join(' ') : e.head.kanji}（${e.head.poj}）・台日新辭書線上版`;
  if (LOCAL) document.body.classList.add('proof');
  let html = headBar(e);
  if (e.status === 'skeleton') {
    html += skeletonNote() + blockImages(e);   // 骨架：建置中說明＋該條原冊書影（B 版）
  } else {
    html += `<div class="twocol">${blockModern(e)}${blockOriginal(e)}</div>` +
            blockImages(e);
  }
  html += `<div class="footnav">${navHTML(e)}</div>`;
  root.innerHTML = html;

  root.addEventListener('click', ev => {
    const z = ev.target.closest('[data-zoom]');
    if (z) {
      ev.preventDefault();
      $('#lightbox img').src = z.dataset.zoom;
      $('#lightbox').classList.add('on');
      return;
    }
    const pb = ev.target.closest('.proofbtn');
    if (pb) { openEdit(pb); return; }
    const rb = ev.target.closest('.reportbtn');
    if (rb) openReport(rb.dataset.block, e.id);
  });
  if (LOCAL) {
    root.addEventListener('dblclick', ev => {
      const t = ev.target.closest('[data-edit]');
      if (t) { ev.preventDefault(); openEdit(t); }
    });
  }
  document.addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea')) return;
    if ($('#editbox') && $('#editbox').classList.contains('on')) return;
    if ($('#reportbox').classList.contains('on')) return;
    if (ev.key === 'ArrowLeft' && e.prev) location.href = 'entry.html?id=' + encodeURIComponent(e.prev);
    if (ev.key === 'ArrowRight' && e.next) location.href = 'entry.html?id=' + encodeURIComponent(e.next);
  });
  $('#lightbox').addEventListener('click', () => $('#lightbox').classList.remove('on'));
  $('#reportsend').addEventListener('click', () => sendReport(e.id));
  $('#reportcancel').addEventListener('click', () => $('#reportbox').classList.remove('on'));
  if ($('#editsend')) {
    $('#editsend').addEventListener('click', submitEdit);
    $('#editcancel').addEventListener('click', () => $('#editbox').classList.remove('on'));
  }
}
document.addEventListener('DOMContentLoaded', init);
