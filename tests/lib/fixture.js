/* =========================================================
   Sinh dữ liệu mẫu tất định – Hành Trình Đón Con (Chủ: qa-tester; T-Q1 10/11/2026).
   Viết TỪ ĐẶC TẢ (tech design 5.3 shape bản ghi, 11.2 hiệu năng), KHÔNG dùng mã app. Không Date.now(), không Math.random.
   - stopRec / nightRec / togetherRec / stageRec / habitDay: một bản ghi hợp lệ, ghi đè trường bằng o.
   - big(): 3.000 bản ghi journal (≈ 2 năm) + 400 ngày thói quen (e2e perf, unit-store xuất).
   - atLocal(day, hh, mm, ss, tz): epoch ms của giờ địa phương theo độ lệch tz phút (không đọc múi giờ máy).
   ========================================================= */
'use strict';

const DAY_MS = 86400000;
const EMOTIONS = ['vui_ve', 'dau_kho', 'lo_lang', 'tuc_gian', 'hoang_hot', 'kho_chiu', 'met_moi', 'binh_an', 'co_don', 'self_blame', 'unsure'];
const IMAGES = ['vui_ve.png', 'dau_kho.png', 'lo_lang.png', 'tuc_gian.png', 'hoang_hot.png', 'kho_chiu.png', 'met_moi.png', 'binh_an.png', 'co_don.png'];
const STAGES = ['start', 'cycle', 'waiting', 'after_loss', 'pause', 'positive', 'none'];
const B_IDS = ['PAUSE5', 'BREATHE_46', 'GROUND_54321', 'RELEASE', 'THOUGHT_CLOUD', 'KNOW_UNKNOWN', 'CALM_SOUND', 'WARM_HAND_DAY'];
const NIGHT_IDS = ['NIGHT_HOME', 'NIGHT_HOME_SHORT', 'NIGHT_TOGETHER', 'NIGHT_WARM_HAND'];
const HABITS = ['sleep', 'move', 'food', 'connect', 'pause', 'screen', 'no_smoke'];

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function idGen(r) {
  const A = '0123456789abcdefghijklmnopqrstuvwxyz';
  return () => { let x = ''; for (let i = 0; i < 20; i++) x += A[Math.floor(r() * 36)]; return x; };
}
function dayNum(day) { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; }
function dayStr(n) { return new Date(n * DAY_MS).toISOString().slice(0, 10); }
function dayAdd(day, k) { return dayStr(dayNum(day) + k); }
function atLocal(day, hh, mm, ss, tz) { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d, hh, mm || 0, ss || 0) - tz * 60000; }

const TZ = 420;
let seq = 0;
const nid = () => { seq++; return ('t' + String(seq).padStart(19, '0')).slice(0, 20); };   // 20 ký tự [0-9a-z]

function stopRec(o) {
  const day = (o && o.day) || '2026-11-10';
  const at = (o && o.at) || atLocal(day, 9, 30, 0, TZ);
  return Object.assign({ v: 1, kind: 'stop', id: nid(), at, day, tz: TZ, origin: 'stop', stage: 'waiting', before: 3, emotions: ['lo_lang'],
    contexts: ['waiting'], minutes: 3, done: [{ ex: 'BREATHE_46', at: at + 60000, end: 'complete' }], after: 5, fit: 'fit' }, o || {});
}
function nightRec(o) {
  const day = (o && o.day) || '2026-11-10';
  return Object.assign({ v: 1, kind: 'night', id: nid(), at: atLocal(day, 22, 0, 0, TZ), day, tz: TZ, stage: 'waiting',
    script: 'NIGHT_TOGETHER', how: 'pace', music: null, end: 'finished', outcome: 'better' }, o || {});
}
function togetherRec(o) {
  const day = (o && o.day) || '2026-11-10';
  return Object.assign({ v: 1, kind: 'together', id: nid(), at: atLocal(day, 20, 0, 0, TZ), day, tz: TZ, exercise: 'C1' }, o || {});
}
function stageRec(o) {
  const day = (o && o.day) || '2026-11-10';
  return Object.assign({ v: 1, kind: 'stage', id: nid(), at: atLocal(day, 8, 0, 0, TZ), day, tz: TZ, from: 'cycle', to: 'waiting', via: 'stage' }, o || {});
}
function habitDay(day, marks) {
  const m = { sleep: '', move: '', food: '', connect: '', pause: '', screen: '', no_smoke: '' };
  return { v: 1, day, marks: Object.assign(m, marks || {}), at: atLocal(day, 21, 0, 0, TZ) };
}

/* 3.000 bản ghi journal + 400 ngày thói quen, kết thúc ở ngày end */
function big(end, seed) {
  const r = rng(seed || 7), id = idGen(r), pick = a => a[Math.floor(r() * a.length)];
  const last = end || '2026-11-10', journal = [], habits = [];
  for (let i = 0; i < 3000; i++) {
    const day = dayAdd(last, -Math.floor(i / 4.2)), at = atLocal(day, 7 + (i % 14), Math.floor(r() * 60), 0, TZ), k = r();
    if (k < 0.7) {
      journal.push(stopRec({ id: id(), at, day, stage: pick(STAGES), before: 1 + Math.floor(r() * 10), emotions: [pick(EMOTIONS)],
        contexts: [], minutes: pick([1, 3, 5, 10, null]), rule: 'R' + (1 + Math.floor(r() * 8)),   // bản ghi CŨ (trước N-1) còn rule: store phải bỏ khi đọc
        done: [{ ex: pick(B_IDS), at: at + 1000, end: 'complete' }], after: r() < 0.3 ? null : 1 + Math.floor(r() * 10), fit: pick(['fit', 'unfit', 'worse', 'unsure', null]) }));
    } else if (k < 0.85) journal.push(nightRec({ id: id(), at, day, script: pick(NIGHT_IDS), outcome: pick(['better', 'same', 'heavier', 'skip', null]) }));
    else if (k < 0.95) journal.push(togetherRec({ id: id(), at, day, exercise: pick(['C1', 'C2', 'C3']) }));
    else journal.push(stageRec({ id: id(), at, day, from: pick(STAGES), to: pick(STAGES), via: pick(['stage', 'mydata', 'result']) }));
  }
  for (let i = 0; i < 400; i++) {
    const marks = {};
    for (const h of HABITS) marks[h] = pick(['', '', 'x', 'a']);
    habits.push(habitDay(dayAdd(last, -i), marks));
  }
  return { journal, habits };
}

module.exports = { rng, idGen, dayNum, dayStr, dayAdd, atLocal, TZ, EMOTIONS, IMAGES, STAGES, B_IDS, NIGHT_IDS, HABITS,
  stopRec, nightRec, togetherRec, stageRec, habitDay, big };
