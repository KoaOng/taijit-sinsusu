// poj_converter.js — 由 query_demo.html 抽出（單一真相在該檔，改規則請兩邊同步或改為 build 步驟）
// 提供：parsePoj / pojToKana / kanaToPoj
const OV = {
  '':   {'a':'ア','i':'イ','u':'ウ','e':'エ','o':'ヲ','oo':'オ','ir':'ウ̄','er':'オ̄'},
  'k':  {'a':'カ','i':'キ','u':'ク','e':'ケ','o':'コ','oo':'コ'},
  'kh': {'a':'カ·','i':'キ·','u':'ク·','e':'ケ·','o':'コ·','oo':'コ·'},
  'g':  {'a':'ガ','i':'ギ','u':'グ','e':'ゲ','o':'ゴ','oo':'ゴ'},
  's':  {'a':'サ','i':'シ','u':'ス','e':'セ','o':'ソ','oo':'ソ'},
  'j':  {'a':'ジャ','i':'ジ','u':'ズ','e':'ゼ','o':'ジョ','oo':'ジョ'},
  'ch': {'a':'サ̄','i':'チ','u':'ツ','e':'セ̄','o':'ソ̄','oo':'ソ̄'},
  'chh':{'a':'サ̄·','i':'チ·','u':'ツ·','e':'セ̄·','o':'ソ̄·','oo':'ソ̄·'},
  't':  {'a':'タ','i':'チ̄','u':'ツ̄','e':'テ','o':'ト','oo':'ト'},
  'th': {'a':'タ·','i':'チ̄·','u':'ツ̄·','e':'テ·','o':'ト·','oo':'ト·'},
  'n':  {'a':'ナ','i':'ニ','u':'ヌ','e':'ネ','o':'ノ','oo':'ノ'},
  'h':  {'a':'ハ','i':'ヒ','u':'フ','e':'ヘ','o':'ホ','oo':'ホ'},
  'b':  {'a':'バ','i':'ビ','u':'ブ','e':'ベ','o':'ボ','oo':'ボ'},
  'p':  {'a':'パ','i':'ピ','u':'プ','e':'ペ','o':'ポ','oo':'ポ'},
  'ph': {'a':'パ·','i':'ピ·','u':'プ·','e':'ペ·','o':'ポ·','oo':'ポ·'},
  'm':  {'a':'マ','i':'ミ','u':'ム','e':'メ','o':'モ','oo':'モ'},
  'l':  {'a':'ラ','i':'リ','u':'ル','e':'レ','o':'ロ','oo':'ロ'},
};
const V_L = {'a':'ア','i':'イ','u':'ウ','e':'エ','o':'ヲ','oo':'オ','ir':'ウ̄','er':'オ̄'};
const F_L = {'p':'プ','t':'ツ','k':'ク','h':'','ng':'ン','m':'ム','n':'ヌ'};
const ONSETS = ['chh','ch','ph','th','kh','ng','p','b','m','t','l','n','k','g','h','s','j'];

function parsePoj(raw) {
  let sRaw = (raw || '').trim();
  if (!sRaw) return null;
  let nasal = false, tone = 0;

  const nasalNMatch = sRaw.match(/^(.+?)N([1-8]?)$/);
  if (nasalNMatch) {
    const beforeN = nasalNMatch[1];
    if (beforeN && 'aeiou'.includes(beforeN[beforeN.length-1].toLowerCase())) {
      nasal = true;
      const td = nasalNMatch[2];
      if (td) tone = parseInt(td);
      sRaw = beforeN;
    }
  }

  let s = sRaw.toLowerCase();
  let nfd = s.normalize('NFD');
  const toneMarks = {'́':2,'̀':3,'̂':5,'̄':7,'̍':8};
  for (const mark in toneMarks) {
    if (nfd.includes(mark)) {
      if (tone===0) tone = toneMarks[mark];
      nfd = nfd.replaceAll(mark, '');
      break;
    }
  }
  // o͘ → '@' sentinel (不會被 lowercase 影響)
  nfd = nfd.replaceAll('o͘', '@').replaceAll('͘', '');
  if (nfd.includes('ⁿ')) { nasal = true; nfd = nfd.replaceAll('ⁿ', ''); }

  s = nfd.normalize('NFC').toLowerCase();
  s = s.replaceAll('oo', '@').replaceAll('ou', '@');

  // *** 順序：先處理 tone digit，再處理 nn 鼻音 ***
  const m = s.match(/^(.+?)([1-8])$/);
  if (m && tone===0) { s = m[1]; tone = parseInt(m[2]); }
  if (s.endsWith('nn')) { nasal = true; s = s.slice(0, -2); }

  let rawClean = sRaw.toLowerCase().normalize('NFD');
  for (const mark in toneMarks) rawClean = rawClean.replaceAll(mark, '');
  rawClean = rawClean.replaceAll('͘','').replaceAll('ⁿ','');
  rawClean = rawClean.normalize('NFC').toLowerCase().replaceAll('oo','@').replaceAll('ou','@');
  const nm = rawClean.match(/^(.+?)([1-8])(n)$/);
  if (nm && !nasal) { nasal = true; s = nm[1]; if (tone===0) tone = parseInt(nm[2]); }

  let onset = '';
  for (const c of ONSETS) {
    if (s.startsWith(c)) { onset = c; s = s.slice(c.length); break; }
  }
  let final = '';
  if (s.endsWith('ng')) { final='ng'; s=s.slice(0,-2); }
  else if (s.endsWith('n')) { final='n'; s=s.slice(0,-1); }
  else if (s.endsWith('m')) { final='m'; s=s.slice(0,-1); }
  else if (s.endsWith('p')) { final='p'; s=s.slice(0,-1); }
  else if (s.endsWith('t')) { final='t'; s=s.slice(0,-1); }
  else if (s.endsWith('k')) { final='k'; s=s.slice(0,-1); }
  else if (s.endsWith('h')) { final='h'; s=s.slice(0,-1); }

  const vowels = [];
  let i = 0;
  while (i < s.length) {
    if (s[i]==='@') { vowels.push('oo'); i++; }
    else if (s.slice(i,i+2)==='ir') { vowels.push('ir'); i+=2; }
    else if (s.slice(i,i+2)==='er') { vowels.push('er'); i+=2; }
    else if ('aeiou'.includes(s[i])) { vowels.push(s[i]); i++; }
    else i++;
  }
  if (tone===0) tone = ['p','t','k','h'].includes(final) ? 4 : 1;
  return {onset, vowels, final, tone, nasal};
}

// 鼻音聲母（m/n/ng）後接母音或獨立音節時，假名自動帶 n 鼻音標
// POJ 不重複標 ⁿ（避免 máⁿ 等非法寫法）— 詳見 kana_poj_rules.json special_rules.auto_nasalize_onsets
const NASAL_ONSETS = ['m', 'n', 'ng'];

function pojToKana(pojStr) {
  const parsed = parsePoj(pojStr);
  if (!parsed) return null;

  // 成節鼻音檢測：vowels 空 + (鼻音聲母 m/n 或 鼻音尾 ng/m/n) → 補假性 'u' + 強制 nasal
  // 例：tńg → t+成節ng → 補u → ツ̄ン2n；m̂ → m 自身成節 → 補u → ム5n
  // 不影響 onset='ng' 的 case（n̂g → ン）— 那已由下方 ng_initial 邏輯處理
  let syllabicNasal = false;
  if (!parsed.vowels.length && parsed.onset !== 'ng') {
    const onsetIsNasal = ['m', 'n'].includes(parsed.onset);
    const finalIsNasal = ['ng', 'm', 'n'].includes(parsed.final);
    if (onsetIsNasal || (parsed.onset && finalIsNasal)) {
      parsed.vowels = ['u'];
      syllabicNasal = true;
    } else {
      return null;
    }
  }

  let onset = parsed.onset;
  const vowels = parsed.vowels, fin = parsed.final, tone = parsed.tone;
  // 自動鼻音化：m/n/ng 聲母 + 成節鼻音 → 強制 nasal=true
  let nasal = parsed.nasal || NASAL_ONSETS.includes(parsed.onset) || syllabicNasal;
  const parts = [];
  let firstVowel = vowels.length ? vowels[0] : null;
  let lookupVowel = firstVowel;
  let middleVowels = [];
  let hasError = false;
  function pushOrErr(k) { if (!k) hasError = true; parts.push(k || '?'); }

  if (onset === 'ng' && !vowels.length) parts.push('ン');
  else if (onset === 'ng') {
    parts.push('ン'); onset = '';
    let v = firstVowel;
    if (v === 'o' && (fin==='p'||fin==='k')) v = 'oo';
    if (v === 'o' && fin === 'ng') v = 'oo';
    pushOrErr(V_L[v]);
    middleVowels = vowels.slice(1).map(mv =>
      (mv==='o' && (fin==='ng'||fin==='p'||fin==='k')) ? 'oo' : mv);
    for (const mv of middleVowels) pushOrErr(V_L[mv]);
    firstVowel = null;
  }

  if (firstVowel !== null) {
    let ekEng = false;
    if (vowels.length===1 && firstVowel==='e' && (fin==='k'||fin==='ng')) {
      lookupVowel='i'; ekEng=true;
    }
    if (onset) {
      pushOrErr((OV[onset]||{})[lookupVowel]);
    } else {
      let v = firstVowel;
      if (v==='o' && (fin==='p'||fin==='k')) v='oo';
      if (v==='o' && fin==='ng') v='oo';
      if (ekEng) v='i';
      pushOrErr(V_L[v]);
    }
    if (ekEng) middleVowels = ['e'];
    else if (vowels.length===1 && (!fin||fin==='h')) middleVowels = (onset && !syllabicNasal) ? [firstVowel] : [];
    else if (vowels.length>=2) middleVowels = vowels.slice(1);
    // POJ → kana 反向同化: ia + (t/n/m/p) → ie (e.g. hian→ヒエヌ, hiam→ヒエム)
    if (vowels.length===2 && vowels[0]==='i' && vowels[1]==='a' && ['t','n'].includes(fin)) middleVowels=['e'];  // 同化只在 t/n（auto_ruby 同步；キアム/チ̄アム/ヒアプ 原書實證 2026-07-08）
    middleVowels = middleVowels.map(v =>
      (v==='o' && (fin==='ng'||fin==='p'||fin==='k')) ? 'oo' : v);
    for (const mv of middleVowels) pushOrErr(V_L[mv]);
  }
  if (fin && fin !== 'h') pushOrErr(F_L[fin]);

  if (hasError) return null;  // 任何 lookup 失敗 → 整體無解

  const kanaStr = parts.join('');
  const toneStr = (tone>1 || nasal) ? String(tone) : '';
  const nasalStr = nasal ? 'n' : '';
  return [kanaStr, toneStr + nasalStr];
}

const OV_REV = {}, V_L_REV = {}, F_L_REV = {};
for (const onset in OV) for (const v in OV[onset]) {
  const k = OV[onset][v];
  (OV_REV[k] = OV_REV[k] || []).push([onset, v]);
}
for (const v in V_L) (V_L_REV[V_L[v]] = V_L_REV[V_L[v]] || []).push(v);
for (const f in F_L) { const k = F_L[f]; if (k) (F_L_REV[k] = F_L_REV[k] || []).push(f); }

function k2pTokenize(kana) {
  const COMBINERS = new Set(['̄', '·', '゚', '̇']);
  const tokens = [];
  let cur = '';
  for (const c of [...kana]) {
    if (COMBINERS.has(c)) cur += c;
    else { if (cur) tokens.push(cur); cur = c; }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function k2pAttachTone(syl, tone, vowels, final, onset) {
  if (tone === 1 || tone === 4) return syl;
  const M = {2:'́', 3:'̀', 5:'̂', 7:'̄', 8:'̍'};
  const mark = M[tone];
  if (!mark) return syl;
  // legacy compat: 沒傳 vowels 時用舊 fallback
  if (!vowels) {
    let pos2 = -1;
    for (const v of ['a','o','e']) { const p = syl.indexOf(v); if (p >= 0) { pos2 = p; break; } }
    if (pos2 < 0) { const ms = syl.match(/[iumn]/g); if (ms) pos2 = syl.lastIndexOf(ms[ms.length-1]); }
    if (pos2 < 0) return syl;
    return syl.slice(0, pos2+1) + mark + syl.slice(pos2+1);
  }
  let pos = -1;
  if (vowels.length === 0) {
    // syllabic nasal: m/ng 沒其他母音時視為 nucleus
    const nucleus = final || onset || '';
    if (nucleus) {
      const firstChar = nucleus[0];
      pos = syl.lastIndexOf(firstChar);
    }
  } else {
    let targetIdx = 0;
    if (vowels.length === 1) targetIdx = 0;
    else if (vowels.length === 3) targetIdx = 1;
    else { // === 2
      if (vowels.includes('i')) targetIdx = vowels[0] === 'i' ? 1 : 0;
      else targetIdx = final ? 1 : 0;
    }
    // 找 syl 中第 targetIdx 個 vowel 位置（跳過 onset，按 vowels 累積）
    let cursor = (onset || '').length;
    for (let i = 0; i < vowels.length; i++) {
      if (i === targetIdx) { pos = cursor; break; }
      // 跳過該 vowel 占的字符數
      // 'oo' 在 syl 中可能是 'o' (useOForOO=true) 或 'o͘' (useOForOO=false, 兩字符)
      if (vowels[i] === 'oo') {
        cursor += (syl.charAt(cursor+1) === '\u0358') ? 2 : 1;
      } else {
        cursor += 1;
      }
    }
  }
  if (pos < 0) return syl;
  return syl.slice(0, pos+1) + mark + syl.slice(pos+1);
}

function k2pProduct(arrs) {
  if (!arrs.length) return [[]];
  const rest = k2pProduct(arrs.slice(1));
  const out = [];
  for (const a of arrs[0]) for (const r of rest) out.push([a, ...r]);
  return out;
}

function k2pBuild(onset, vowels, final, tone, useOForOO) {
  let syl = onset;
  for (const v of vowels) {
    if (v === 'oo') syl += (useOForOO ? 'o' : 'o͘');
    else syl += v;
  }
  if (final) syl += final;
  return k2pAttachTone(syl, tone, vowels, final, onset);
}

function k2pBuildAscii(onset, vowels, final, tone, nasal, useOForOO) {
  let s = onset;
  for (const v of vowels) {
    if (v === 'oo') s += (useOForOO ? 'o' : 'oo');
    else s += v;
  }
  if (final) s += final;
  s += String(tone);
  if (nasal && !NASAL_ONSETS.includes(onset)) s += 'nn';
  return s;
}

function kanaToPoj(kanaStr) {
  let s = (kanaStr || '').trim();
  if (!s) return [];
  let tone = 1, nasal = false;
  if (s.endsWith('n')) { nasal = true; s = s.slice(0, -1); }
  const tm = s.match(/^(.+?)([1-8])$/);
  if (tm) { tone = parseInt(tm[2]); s = tm[1]; }
  if (!s) return [];
  const tokens = k2pTokenize(s);
  if (!tokens.length) return [];

  const candidates = [];

  function tryParse(hasOnset, hasFinal, forceFinal) {
    const onsetCands = hasOnset ? (OV_REV[tokens[0]] || []) : [['', null]];
    if (!onsetCands.length) return;
    const startIdx = hasOnset ? 1 : 0;
    let endIdx, finalCands;
    if (forceFinal) {
      endIdx = tokens.length;
      finalCands = [forceFinal];
    } else if (hasFinal) {
      endIdx = tokens.length - 1;
      finalCands = F_L_REV[tokens[tokens.length-1]] || [];
      if (!finalCands.length) return;
    } else {
      endIdx = tokens.length;
      finalCands = [''];
    }
    if (startIdx > endIdx) return;
    const middleVowelChoices = [];
    for (let i = startIdx; i < endIdx; i++) {
      const cs = V_L_REV[tokens[i]] || [];
      if (!cs.length) return;
      middleVowelChoices.push(cs);
    }

    for (const [onset, firstVowel] of onsetCands) {
      for (const final of finalCands) {
        const middleCombos = middleVowelChoices.length ? k2pProduct(middleVowelChoices) : [[]];
        for (const middleVs of middleCombos) {
          let vowels = firstVowel != null ? [firstVowel, ...middleVs] : [...middleVs];
          if (!vowels.length && onset !== 'ng') continue;

          if (onset && vowels.length === 2 && vowels[0] === vowels[1] && (!final || final === 'h')) {
            vowels = [vowels[0]];
          }
          if (vowels.length === 2 && vowels[0] === 'i' && vowels[1] === 'e' && (final === 'k' || final === 'ng')) {
            vowels = ['e'];  // POJ 縮寫: iek→ek, ieng→eng
          } else if (vowels.length === 2 && vowels[0] === 'i' && vowels[1] === 'e' && ['t','n'].includes(final)) {
            vowels = ['i','a'];  // POJ 同化: iet→iat, ien→ian, iem→iam, iep→iap
          }

          const useOForOO = (final === 'ng' || final === 'p' || final === 'k');
          let display = k2pBuild(onset, vowels, final, tone, useOForOO);
          const ascii = k2pBuildAscii(onset, vowels, final, tone, nasal, useOForOO);
          if (nasal && !NASAL_ONSETS.includes(onset)) display += 'ⁿ';
          candidates.push({display, ascii, onset, vowels, final});
        }
      }
    }
  }

  tryParse(true, true);
  tryParse(true, false);
  tryParse(false, true);
  tryParse(false, false);
  // 入聲 (4/8 聲) 必須有 -p/-t/-k/-h 結尾。kana 中無 -h 對應 token，靠 tone digit 推
  if (tone === 4 || tone === 8) {
    tryParse(true, false, 'h');
    tryParse(false, false, 'h');
  }

  if (tokens[0] === 'ン') {
    if (tokens.length === 1) {
      candidates.push({
        display: k2pAttachTone('ng', tone),
        ascii: 'ng' + tone,
        onset: 'ng', vowels: [], final: ''
      });
    } else {
      const restTokens = tokens.slice(1);
      function ngParse(hasFinal) {
        const endIdx = hasFinal ? restTokens.length - 1 : restTokens.length;
        const finalCands = hasFinal ? (F_L_REV[restTokens[restTokens.length-1]] || []) : [''];
        if (hasFinal && !finalCands.length) return;
        const vowelChoices = [];
        for (let i = 0; i < endIdx; i++) {
          const cs = V_L_REV[restTokens[i]] || [];
          if (!cs.length) return;
          vowelChoices.push(cs);
        }
        const combos = vowelChoices.length ? k2pProduct(vowelChoices) : [[]];
        for (const final of finalCands) {
          for (const vowels of combos) {
            const useOForOO = (final === 'ng' || final === 'p' || final === 'k');
            const display = k2pBuild('ng', vowels, final, tone, useOForOO);
            const ascii = k2pBuildAscii('ng', vowels, final, tone, nasal, useOForOO);
            candidates.push({display, ascii, onset:'ng', vowels, final});
          }
        }
      }
      ngParse(true);
      ngParse(false);
    }
  }

  // === syllabic nasal candidates (nasal flag + onset/final m/n/ng + 假性 vowel u) ===
  if (nasal) {
    const syllabicAdded = [];
    for (const c of candidates) {
      const isU = c.vowels.length === 1 && c.vowels[0] === 'u';
      if (!isU) continue;
      // Pattern A: m̂ / n̂ (onset m/n, no final)
      if ((c.onset === 'm' || c.onset === 'n') && !c.final) {
        const syl = c.onset;
        syllabicAdded.push({
          display: k2pAttachTone(syl, tone, [], '', c.onset),
          ascii: c.onset + tone,
          onset: c.onset, vowels: [], final: ''
        });
      }
      // Pattern B: hm̂ (h onset, m/n/ng final)
      if (c.onset === 'h' && (c.final === 'm' || c.final === 'n' || c.final === 'ng')) {
        const syl = c.onset + c.final;
        syllabicAdded.push({
          display: k2pAttachTone(syl, tone, [], c.final, c.onset),
          ascii: c.onset + c.final + tone,
          onset: c.onset, vowels: [], final: c.final
        });
      }
      // Pattern C: mn̂g (m/n onset, ng final)
      if ((c.onset === 'm' || c.onset === 'n') && c.final === 'ng') {
        const syl = c.onset + c.final;
        syllabicAdded.push({
          display: k2pAttachTone(syl, tone, [], c.final, c.onset),
          ascii: c.onset + c.final + tone,
          onset: c.onset, vowels: [], final: c.final
        });
      }
    }
    // syllabic candidate 排前面（priority 高，因為 nasal flag 通常表 syllabic）
    candidates.unshift(...syllabicAdded);
  }
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    if (!seen.has(c.display)) { seen.add(c.display); unique.push(c); }
  }
  unique.sort((a, b) => {
    // 入聲 tone：有 final (-h/-p/-t/-k) 優先 (POJ 規則上才合法)
    if (tone === 4 || tone === 8) {
      const aHasFinal = !!a.final;
      const bHasFinal = !!b.final;
      if (aHasFinal !== bHasFinal) return aHasFinal ? -1 : 1;
    }
    if ((a.onset !== '') !== (b.onset !== '')) return a.onset !== '' ? -1 : 1;
    return a.display.length - b.display.length;
  });
  return unique.slice(0, 5);
}
