/* =========================================================
   Hành Trình Đón Con – js/engine.js · window.HTDC_ENGINE · Chủ: FE-2 Luật & nội dung (T-02)
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 6 (interface 6.3, thứ tự 6.4, luật 6.5, bài đêm 6.6), 5.3 (check.*);
           PRD v0.3 mục 8.1–8.4, 8.6; K-5, K-6, K-13, K-14; L-6, L-7.
   Nguồn: apps/lifestyle-thai-phu/js/engine.js:20–60 @ 10/11/2026 (stripMarks, tokens, has, hasAny, views, selfHarmStop4p —
          cách so NGUYÊN VĂN STOP-4P js/engine.js:82–96, bản sau review lần 7) và :127–170 (detectNames, detectPII) — ADR 0008.
   Hàm THUẦN: không DOM, không storage, không Date.now(). Đọc window.HTDC_CONFIG / HTDC_SCRIPTS lúc GỌI (test bật/tắt được).
   Luật an toàn chạy trước gợi ý; cờ phiên chỉ cộng thêm. Không khớp luật nào KHÔNG có nghĩa là an toàn; app không chẩn đoán.
   ========================================================= */
window.HTDC_ENGINE = (() => {
  'use strict';
  const D = window.HTDC_DATA, K = window.HTDC_KEYWORDS, U = window.HTDC_UTIL;
  const cfg = () => window.HTDC_CONFIG || {};
  const scripts = () => (window.HTDC_SCRIPTS || {}).SCRIPTS || {};
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const draftOk = x => !!cfg().ALLOW_DRAFT_CONTENT || (!!x && x.status === 'approved');

  /* ===== Chuẩn hóa chữ (chép lifestyle engine.js:20–29, giống STOP-4P) ===== */
  const stripMarks = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const tokens = s => ' ' + s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
  const has = (t, list) => list.some(k => t.includes(' ' + k + ' '));
  function hasAny(text, list, loose = true) {
    const t = tokens(loose ? stripMarks(text) : String(text || '').toLowerCase().normalize('NFC'));
    return list.some(k => t.includes(' ' + (loose ? stripMarks(k) : k.normalize('NFC')) + ' '));
  }

  // Mọi cách nhìn một đoạn chữ (chép lifestyle engine.js:32–46; phần STOP-4P giữ đúng thứ tự và phép biến đổi)
  function views(text) {
    const UR = K.urgent;
    const flat = tokens(stripMarks(text));
    const nfc = tokens(String(text).toLowerCase().normalize('NFC'));
    const nfcP = ' ' + String(text).toLowerCase().normalize('NFC').replace(/[.!?;…]+/g, ' . ').replace(/,+/g, ' , ')
      .replace(/[^\p{L}\p{N}.,]+/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
    const teenD = w => (Object.hasOwn(UR.teen, w) ? UR.teen[w] : w);
    const teenL = w => (Object.hasOwn(UR.teen, w) ? stripMarks(UR.teen[w]) : w);
    const nfcU = tokens(nfc.replace(/[^ ]+/g, teenD)), flatU = tokens(stripMarks(nfcU));
    const nfcUL = tokens(nfc.replace(/[^ ]+/g, teenL));   // giữ dấu, teen → không dấu: so cụm KHÔNG dấu của nhóm mới
    return { flat, nfc, nfcP, nfcU, flatU, nfcUL };
  }

  /* ===== 8.1 bước 1: tự hại — NGUYÊN VĂN STOP-4P (lifestyle engine.js:50–54) ===== */
  function selfHarmStop4p(v) {
    const UR = K.urgent;
    return has(v.nfcU, UR.strict.map(k => k.normalize('NFC'))) || UR.strictPatterns.some(re => re.test(v.nfcU))
      || has(v.flatU, UR.loose) || UR.patterns.some(re => re.test(v.nfcP));
  }
  // Nhóm mới: strict so có dấu, loose so chữ gõ không dấu; exclude bỏ cụm vô hại trước khi so
  function hitGroup(g, v) {
    let a = v.nfcU, b = v.nfcUL;
    for (const re of g.exclude || []) { a = a.replace(re, ' ⊘ '); b = b.replace(re, ' ⊘ '); }   // T-I1: exclude áp cả lượt so không dấu
    return has(a, g.strict.map(k => k.normalize('NFC'))) || has(b, g.loose || []);
  }
  const GROUPS = ['hopeless', 'selfblame', 'home', 'loss', 'prolonged'];

  /* ===== safetyCheck(text) → { selfHarm, human, groups[], body } — chạy khi bấm tiếp, không khi đang gõ ===== */
  function safetyCheck(text) {
    const s = String(text ?? '');
    const out = { selfHarm: false, human: false, groups: [], body: false };
    if (!s.trim()) return out;
    const v = views(s);
    out.selfHarm = selfHarmStop4p(v);
    // human STOP-4P: so như STOP-4P js/engine.js:97–99 (không teen)
    out.human = hasAny(s, K.human.list) || hasAny(s, K.human.strict, false) || K.human.patterns.some(re => re.test(v.flat));
    out.groups = GROUPS.filter(g => hitGroup(K.groups[g], v));
    out.body = hitGroup(K.body, v);
    return out;
  }

  /* ===== Thông tin nhận diện (PRD 8.6; chép lifestyle engine.js:111–170, why = mã) ===== */
  const P = K.pii;
  const PII_PATTERNS = [{ re: P.phone, why: 'phone' }, { re: P.digits, why: 'digits' }, { re: P.email, why: 'email' },
    { re: P.codes, why: 'code' }, ...P.address.map(re => ({ re, why: 'address' }))];
  const NAME_WORD = /^\p{Lu}\p{Ll}*$/u;
  const TITLES = new Set(P.titles), ABBR = new Set(P.abbrTitles), SENTENCE_START = new Set(P.sentenceStart);
  // Danh xưng + Từ Viết Hoa → có thể là tên người (thuật toán STOP-4P review lần 3 R-1, lần 4 G-2; danh xưng tới 3 chữ)
  function detectNames(text) {
    const words = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map(m => ({ w: m[0], lw: m[0].toLowerCase(), s: m.index, e: m.index + m[0].length }));
    const sameLine = (a, b, dot) => (dot ? /^\.?[\p{Zs}\t]+$/u : /^[\p{Zs}\t]+$/u).test(text.slice(a.e, b.s));
    const hits = [];
    for (let i = 0; i < words.length; i++) {
      let t = 0;
      for (let n = 3; n >= 1 && !t; n--) {
        if (i + n > words.length) continue;
        let ok = true;
        for (let k = i + 1; k < i + n; k++) if (!sameLine(words[k - 1], words[k])) ok = false;
        if (ok && TITLES.has(words.slice(i, i + n).map(x => x.lw).join(' '))) t = n;
      }
      if (!t) continue;
      let j = i + t, last = -1;
      const dotOk = t === 1 && ABBR.has(words[i].lw);
      if (dotOk && j < words.length && /\./.test(text.slice(words[i].e, words[j].s)) && SENTENCE_START.has(words[j].lw)) continue;
      while (j < words.length && sameLine(words[j - 1], words[j], j === i + t && dotOk) && NAME_WORD.test(words[j].w)) { last = j; j++; }
      if (last < 0) continue;
      hits.push({ text: text.slice(words[i].s, words[last].e), why: 'name' });
      i = last;
    }
    return hits;
  }
  // detectPII(text) → [{ text, why: 'phone'|'digits'|'email'|'name'|'code'|'address' }]. Không thể phát hiện hết.
  function detectPII(text) {
    if (!text) return [];
    const str = String(text).normalize('NFC');
    let hits = [];
    for (const p of PII_PATTERNS) for (const m of str.matchAll(p.re)) hits.push({ text: m[0].trim(), why: p.why, s: m.index, e: m.index + m[0].length });
    // Vùng nằm GỌN trong vùng mẫu khác (dãy số trong SĐT, số trong "mã IVF …") không báo lần hai (STOP-4P G-03)
    hits = hits.filter((h, i) => !hits.some((o, k) => k !== i && o.s <= h.s && o.e >= h.e && (o.e - o.s > h.e - h.s || k < i)));
    hits.sort((a, b) => a.s - b.s);
    hits.push(...detectNames(str));
    const seen = new Set();
    return hits.map(h => ({ text: h.text, why: h.why })).filter(h => (seen.has(h.text) ? false : seen.add(h.text)));
  }

  /* ===== Mức 10 chấm (ngưỡng Check-in Mẹ Bầu; chỉ dùng nội bộ, không tô màu lên màn) ===== */
  const isLevel = n => Number.isInteger(n) && n >= 1 && n <= 10;
  const band = level => (!isLevel(level) ? null : level <= 3 ? 'low' : level <= 5 ? 'mid' : 'ok');
  // Nhận Set / mảng / mọi thứ lặp được (kể cả Set tạo ở realm khác, vd test chạy vm); chuỗi, null → rỗng
  const toSet = x => new Set(x == null || typeof x === 'string' || typeof x[Symbol.iterator] !== 'function' ? [] : x);

  /* ===== assess: thứ tự 8.1 bước 1–4 → route + cờ phiên (chỉ cộng) =====
     Cờ: self_harm, not_alone, self_blame, loss, body, prolonged, two_weeks, low */
  function assess({ texts = [], level = null, emotions = [], flags } = {}) {
    const F = toSet(flags), emo = new Set(emotions || []);
    let urgent = false;
    for (const t of [].concat(texts).filter(x => typeof x === 'string' && x.trim())) {
      const c = safetyCheck(t);
      if (c.selfHarm) { urgent = true; F.add('self_harm'); F.add('not_alone'); }
      if (c.human || c.groups.length) F.add('not_alone');
      if (c.groups.includes('selfblame')) F.add('self_blame');
      if (c.groups.includes('loss')) F.add('loss');
      if (c.groups.includes('prolonged')) { F.add('prolonged'); F.add('two_weeks'); }
      if (c.body) F.add('body');
    }
    const b = band(level);
    if (b === 'low') { F.add('low'); F.add('not_alone'); }
    if (b === 'mid') F.add('two_weeks');
    if (emo.has('self_blame')) F.add('self_blame');                                   // L-7: thẻ Tự trách → câu ghi nhận
    if ((emo.has('co_don') || emo.has('dau_kho')) && isLevel(level) && level <= 5) F.add('not_alone');
    return { route: urgent ? 'urgent' : b === 'low' ? 'safety_q' : 'next', flags: F };
  }

  /* ===== Lọc bài: trong danh mục, không nín thở, draft được phép, màn có thật ===== */
  // available: hàm (tên màn → bool, vd api.has) | mảng | Set tên màn; bỏ trống = chỉ màn A1 ('player', bài đêm)
  function screenOk(screen, available) {
    if (typeof available === 'function') return !!available(screen);
    if (available) return toSet(available).has(screen);
    return screen === 'player' || screen === 'night_how';
  }
  function itemOf(id) {
    if (typeof id !== 'string') return null;
    if (own(D.EXERCISES, id)) return D.EXERCISES[id];
    const sc = scripts();
    return own(sc, id) ? Object.assign({}, sc[id], { screen: 'night_how' }) : null;
  }
  function allowed(id, available) {
    const x = itemOf(id);
    return !!x && !x.holdsBreath && draftOk(x) && screenOk(x.screen || 'player', available);
  }
  // validate(ids, {available}) → ids hợp lệ, không trùng (không cắt: recommend tự lấy ≤ 2)
  const validate = (ids, { available } = {}) => [...new Set([].concat(ids || []))].filter(id => allowed(id, available));

  /* ===== Luật gợi ý R1–R8 (+R3b) — PRD 8.3, tech design 6.5. Dừng ở dòng đầu tiên khớp. ===== */
  const CALM_FIRST = ['hoang_hot', 'tuc_gian', 'lo_lang', 'kho_chiu'];
  const NO_GRIEF = ['BREATHE_46', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN'];        // AC-39b: không ở vị trí gợi ý khi đau buồn
  const RULES = [
    { rule: 'R1', when: x => x.F.has('body'), ids: ['CALM_SOUND', 'PAUSE5'] },
    { rule: 'R2', when: x => x.emo.has('dau_kho') || x.stage === 'after_loss', ids: ['WARM_HAND_DAY', 'CALM_SOUND', 'PAUSE5'] },
    { rule: 'R3', when: x => CALM_FIRST.some(c => x.emo.has(c)), ids: ['BREATHE_46', 'GROUND_54321', 'PAUSE5'] },
    { rule: 'R3b', when: x => x.emo.has('self_blame'), ids: ['WARM_HAND_DAY', 'THOUGHT_CLOUD'] },
    { rule: 'R4', when: x => x.stage === 'waiting', ids: ['THOUGHT_CLOUD', 'KNOW_UNKNOWN'] },
    { rule: 'R5', when: x => x.emo.has('co_don') || x.ctx.has('couple'), ids: ['THREE_QUESTIONS', 'SEND_WORDS', 'WARM_HAND_DAY'] },
    { rule: 'R6', when: x => x.emo.has('met_moi'), ids: ['CALM_SOUND', 'RELEASE'] },
    { rule: 'R7', when: x => x.late, ids: ['RELEASE'] },
    { rule: 'R8', when: () => true, ids: ['BREATHE_46', 'GROUND_54321', 'THOUGHT_CLOUD'] }
  ];
  const RULE = Object.fromEntries(RULES.map(r => [r.rule, r]));
  const LOW_KEEP = ['R1', 'R2', 'R3', 'R3b'];                                   // L-6: R3b tính là thuộc nhóm này

  /* recommend(input, attempt) → { rule, list, cards[], suggestions:[{id, reason}] ≤ 2 }
     rule = dòng khớp (CHỈ trong bộ nhớ, không ghi vào StopRec — N-1); list = dòng lấy ứng viên (mức thấp không thuộc R1–R3b → 'R3', K-6).
     Thẻ là hàm ĐƠN ĐIỆU của cờ / thẻ cảm xúc / chip: thêm thông tin không làm mất thẻ đã có (tech design 6.4). */
  function recommend(input = {}, attempt = 0) {
    const { level = null, emotions = [], contexts = [], stage = null, minutes = null, hour = null, flags, available } = input || {};
    const F = toSet(flags), emo = new Set(emotions || []), ctx = new Set(contexts || []);
    const lateHour = Number.isFinite(cfg().LATE_HOUR) ? cfg().LATE_HOUR : 21;
    const late = ctx.has('sleep') || (Number.isFinite(hour) && hour >= lateHour);
    const b = band(level);
    // Không hạ mức: cờ 'low' (đã chấm 1–3 trong phiên) hoặc 'self_harm' (đã qua M20) giữ cách gợi ý của mức thấp
    const low = b === 'low' || F.has('low') || F.has('self_harm');
    const x = { F, emo, ctx, stage, late };
    const hit = RULES.find(r => r.when(x));
    const listRule = low && !LOW_KEEP.includes(hit.rule) ? 'R3' : hit.rule;
    const grief = stage === 'after_loss' || emo.has('dau_kho');
    // Bước 1–3: an toàn đau buồn → mức thấp bỏ bài cần viết → lọc phút
    const clean = ids => ids.filter(id => allowed(id, available))
      .filter(id => !(grief && NO_GRIEF.includes(id)))
      .filter(id => !(low && D.EXERCISES[id] && D.EXERCISES[id].needsWriting));
    const fit = id => !minutes || !itemOf(id) || itemOf(id).min <= minutes;
    let pool = clean(RULE[listRule].ids).filter(fit).map(id => ({ id, reason: listRule }));
    if (!pool.length && allowed('PAUSE5', available)) pool = [{ id: 'PAUSE5', reason: listRule }];   // 0,5 phút luôn vừa
    // Bước 4: "Đổi gợi ý" nối ứng viên R8 (mức thấp và R1 thì không), cửa sổ 2 bài trượt vòng tròn
    if (!low && hit.rule !== 'R1') {
      for (const id of clean(RULE.R8.ids).filter(fit)) if (!pool.some(p => p.id === id)) pool.push({ id, reason: 'R8' });
    }
    const n = pool.length, start = n ? ((Math.max(0, Math.floor(+attempt || 0)) * 2) % n) : 0;
    const suggestions = n ? [pool[start], pool[(start + 1) % n]].filter((p, i, a) => a.findIndex(q => q.id === p.id) === i) : [];

    // Thẻ theo thứ tự PRD 8.1: cần bác sĩ → không một mình → ghi nhận tự trách → đổi chặng đường → hai tuần → sang đêm
    const lonelyA1 = (emo.has('co_don') || ctx.has('couple')) && !allowed('THREE_QUESTIONS', available) && !allowed('SEND_WORDS', available);
    const cards = [];
    if (F.has('body')) cards.push('need_doctor');
    if (F.has('not_alone') || F.has('self_harm') || low || lonelyA1
      || ((emo.has('co_don') || emo.has('dau_kho')) && isLevel(level) && level <= 5)) cards.push('not_alone');
    if (F.has('self_blame') || emo.has('self_blame')) cards.push('self_blame_ack');
    if (F.has('loss') && stage !== 'after_loss') cards.push('ask_stage_change');
    if (b === 'mid' || F.has('two_weeks') || F.has('prolonged')) cards.push('two_weeks');
    if (late) cards.push('go_night');
    return { rule: hit.rule, list: listRule, cards, suggestions: suggestions.slice(0, 2) };
  }

  /* ===== Thư viện (B1–B8, thứ tự cố định, lọc draft; không lọc theo giai đoạn) ===== */
  const library = ({ available } = {}) => D.LIBRARY_ORDER.filter(id => allowed(id, available));

  /* ===== Bài đêm (PRD 8.4, tech design 6.6) ===== */
  const NIGHT = ['NIGHT_HOME', 'NIGHT_HOME_SHORT', 'NIGHT_TOGETHER', 'NIGHT_WARM_HAND'];
  const BABY = ['NIGHT_HOME', 'NIGHT_HOME_SHORT'];                               // dự phòng khi scripts.js chưa có hasBaby
  const NIGHT_BY_STAGE = {
    start: ['NIGHT_HOME', 'NIGHT_TOGETHER'], cycle: ['NIGHT_HOME', 'NIGHT_TOGETHER'],
    waiting: ['NIGHT_HOME_SHORT', 'NIGHT_TOGETHER'], pause: ['NIGHT_TOGETHER', 'NIGHT_WARM_HAND', 'NIGHT_HOME'],
    positive: ['NIGHT_HOME', 'NIGHT_HOME_SHORT'], none: ['NIGHT_TOGETHER', 'NIGHT_HOME']
  };
  const nightOk = id => own(scripts(), id) && draftOk(scripts()[id]);
  const hasBaby = id => BABY.includes(id) || !!(own(scripts(), id) && scripts()[id].hasBaby);
  const lossOn = (stage, flags) => stage === 'after_loss' || toSet(flags).has('loss');
  // nightList → { suggested, all }: sau tin buồn / cờ mất con không bao giờ gợi ý bài em bé (AC-41)
  function nightList({ stage = null, flags } = {}) {
    const base = lossOn(stage, flags) ? ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER'] : (NIGHT_BY_STAGE[stage] || NIGHT_BY_STAGE.none);
    const suggested = base.filter(nightOk).filter(id => !(lossOn(stage, flags) && hasBaby(id)));
    return { suggested, all: NIGHT.filter(nightOk) };
  }
  // nightGate → cổng hỏi MỖI LẦN mở bài em bé (V1, AC-40); xác nhận sau tin buồn chạy trước cổng (AC-42)
  function nightGate(id, { stage = null, flags } = {}) {
    const baby = hasBaby(id);
    return { confirmLoss: baby && lossOn(stage, flags), gate: baby };
  }
  function gateOutcome(answer) {
    if (answer === 'warm') return { play: true, suggest: [] };
    if (answer === 'heavy') return { play: false, suggest: ['NIGHT_WARM_HAND', 'NIGHT_TOGETHER'].filter(nightOk) };
    return { play: false, suggest: ['NIGHT_TOGETHER'].filter(nightOk) };          // 'unsure' và mọi giá trị lạ
  }

  /* ===== Thẻ "Điều nên biết" (ẩn khi draft bị tắt; none → null) ===== */
  function stageCard(stage) {
    const c = own(D.STAGE_CARDS, stage) ? D.STAGE_CARDS[stage] : null;
    if (!c || !draftOk(c)) return null;
    return { id: c.id, text: c.text, review: { status: c.status, reviewer: c.reviewer, reviewedAt: c.reviewedAt } };
  }

  /* ===== check.*: kiểm shape bản ghi đọc từ máy (whitelist; tech design 5.3, 5.5) =====
     Trường bắt buộc sai → null (bản ghi bị bỏ khỏi bộ nhớ, store giữ nguyên trong DB). Trường lạ bị bỏ.
     Mã lạ trong mảng bị lọc; chữ dài bị cắt. */
  const codes = list => new Set(list.map(x => x.code));
  const STAGE_SET = codes(D.STAGES), EMO_SET = codes(D.EMOTIONS), CTX_SET = codes(D.CONTEXTS), HABIT_SET = codes(D.HABITS);
  const ROLE_SET = codes(D.ROLES);
  const isId = s => typeof s === 'string' && /^[0-9a-z]{8,40}$/.test(s);
  const isAt = n => Number.isFinite(n) && n >= 0 && n < 8.64e15;
  const isTz = n => Number.isInteger(n) && n >= -840 && n <= 840;
  const isDay = d => typeof d === 'string' && (U && U.isDay ? U.isDay(d) : /^\d{4}-\d{2}-\d{2}$/.test(d));
  const oneOf = (v, list) => list.includes(v);
  const optOf = (v, list) => (v == null ? null : list.includes(v) ? v : undefined);
  const optLevel = v => (v == null ? null : isLevel(v) ? v : undefined);
  const strCut = (s, n) => (typeof s === 'string' ? s.slice(0, n) : undefined);
  const codeList = (a, set, max) => (Array.isArray(a) ? [...new Set(a.filter(c => set.has(c)))].slice(0, max) : a == null ? [] : undefined);
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  // Khung chung mọi bản ghi journal
  function head(r, kind) {
    if (!isObj(r) || r.v !== 1 || r.kind !== kind || !isId(r.id) || !isAt(r.at) || !isDay(r.day) || !isTz(r.tz)) return null;
    return { v: 1, kind, id: r.id, at: r.at, day: r.day, tz: r.tz };
  }
  const bad = o => Object.values(o).some(v => v === undefined);

  function checkStop(r) {
    const h = head(r, 'stop');
    if (!h) return null;
    const o = Object.assign(h, {
      origin: oneOf(r.origin, ['stop', 'library']) ? r.origin : undefined,
      stage: optOf(r.stage, [...STAGE_SET]), before: optLevel(r.before),
      emotions: codeList(r.emotions, EMO_SET, 3), contexts: codeList(r.contexts, CTX_SET, 9),
      minutes: optOf(r.minutes, D.MINUTES),   // không có rule: R1 ⇔ cờ từ khóa 8.2b, không ghi (N-1, Team Lead chốt 10/11/2026)
      done: Array.isArray(r.done) || r.done == null ? (r.done || []).filter(d => isObj(d) && own(D.EXERCISES, d.ex) && isAt(d.at)
        && oneOf(d.end, ['complete', 'natural', 'uneasy', 'left'])).map(d => ({ ex: d.ex, at: d.at, end: d.end })).slice(-10) : undefined,
      after: optLevel(r.after), fit: optOf(r.fit, D.FITS.map(f => f.code))
    });
    if (bad(o)) return null;
    const max = Number.isFinite(cfg().NOTE_MAX) ? cfg().NOTE_MAX : 1000;
    if (typeof r.note === 'string') o.note = r.note.slice(0, max);
    if (isObj(r.texts)) {
      const list = a => (Array.isArray(a) ? a.filter(s => typeof s === 'string').map(s => s.slice(0, 120)).slice(0, 5) : undefined);
      const t = { thought: strCut(r.texts.thought, 200), know: list(r.texts.know), unknown: list(r.texts.unknown), todo: list(r.texts.todo) };
      Object.keys(t).forEach(k => t[k] === undefined && delete t[k]);
      if (Object.keys(t).length) o.texts = t;
    }
    return o;
  }
  function checkNight(r) {
    const h = head(r, 'night');
    if (!h) return null;
    const o = Object.assign(h, {
      stage: optOf(r.stage, [...STAGE_SET]), script: oneOf(r.script, NIGHT) ? r.script : undefined,
      how: oneOf(r.how, ['pace', 'read', 'voice']) ? r.how : undefined, music: optOf(r.music, ['waves', 'rain', 'wind']),
      end: oneOf(r.end, ['finished', 'stopped', 'heavy', 'left']) ? r.end : undefined,
      outcome: optOf(r.outcome, D.NIGHT_OUTCOMES.map(x => x.code))
    });
    return bad(o) ? null : o;
  }
  // AC-56: chỉ đúng các trường này, không cảm xúc, không chữ
  function checkTogether(r) {
    const h = head(r, 'together');
    return h && oneOf(r.exercise, ['C1', 'C2', 'C3']) ? Object.assign(h, { exercise: r.exercise }) : null;
  }
  function checkStage(r) {
    const h = head(r, 'stage');
    if (!h) return null;
    const o = Object.assign(h, { from: optOf(r.from, [...STAGE_SET]), to: STAGE_SET.has(r.to) ? r.to : undefined,
      via: oneOf(r.via, ['stage', 'mydata', 'result']) ? r.via : undefined });
    return bad(o) ? null : o;
  }
  function checkHabitDay(r) {
    if (!isObj(r) || r.v !== 1 || !isDay(r.day) || !isAt(r.at) || !isObj(r.marks)) return null;
    const marks = {};
    for (const c of HABIT_SET) {
      const m = r.marks[c] == null ? '' : r.marks[c];
      if (!oneOf(m, ['', 'x', 'a'])) return null;
      marks[c] = m;
    }
    return { v: 1, day: r.day, marks, at: r.at };
  }
  function checkKv(r) {
    if (!isObj(r) || typeof r.k !== 'string') return null;
    const v = r.v;
    switch (r.k) {
      case 'role': return ROLE_SET.has(v) ? { k: 'role', v } : null;
      case 'stage': return isObj(v) && STAGE_SET.has(v.code) && isAt(v.at) ? { k: 'stage', v: { code: v.code, at: v.at } } : null;
      case 'habits': return isObj(v) && Array.isArray(v.enabled) ? { k: 'habits', v: { enabled: codeList(v.enabled, HABIT_SET, 7) } } : null;
      case 'closedCards': {
        if (!isObj(v)) return null;
        const o = {};
        for (const [s, at] of Object.entries(v)) if (STAGE_SET.has(s) && isAt(at)) o[s] = at;
        return { k: 'closedCards', v: o };
      }
      case 'sound': return isObj(v) && Number.isInteger(v.volume) && v.volume >= 0 && v.volume <= 100 ? { k: 'sound', v: { volume: v.volume } } : null;
      default: return null;
    }
  }
  const CHECK = { stop: checkStop, night: checkNight, together: checkTogether, stage: checkStage };
  const check = Object.assign({}, CHECK, {
    habitDay: checkHabitDay, kv: checkKv,
    journal: r => (isObj(r) && own(CHECK, r.kind) ? CHECK[r.kind](r) : null)        // tiện cho store: chọn theo kind
  });

  /* ===== Nhãn cho xuất CSV, M17 (mã lạ → trả mã) ===== */
  const labelIn = (list, c) => (list.find(x => x.code === c) || {}).label || String(c ?? '');
  function label(kind, c) {
    if (kind === 'stage') return labelIn(D.STAGES, c);
    if (kind === 'emotion') return labelIn(D.EMOTIONS, c);
    if (kind === 'context') return labelIn(D.CONTEXTS, c);
    if (kind === 'fit') return labelIn(D.FITS, c);
    if (kind === 'habit') return labelIn(D.HABITS, c);
    if (kind === 'role') return labelIn(D.ROLES, c);
    if (kind === 'exercise') { const x = itemOf(c); return x ? x.title || String(c) : String(c ?? ''); }
    return String(c ?? '');
  }

  return {
    safetyCheck, detectPII, band, assess, recommend, library, nightList, nightGate, gateOutcome, validate, check, stageCard,
    label, allowed, stripMarks, NIGHT, RULES: RULES.map(r => ({ rule: r.rule, ids: r.ids.slice() }))
  };
})();
