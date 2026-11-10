/* =========================================================
   Hành Trình Đón Con – js/sound.js · window.HTDC_SOUND · Chủ: FE-4 Dừng lại & Thư viện (T-04)
   Đặc tả: docs/specs/hiem-muon-tech-design.md mục 2.1, 7.3, 8; PRD AC-48, AC-53; UX mục 9.
   Nguồn: apps/lifestyle-thai-phu/js/sound.js @ 10/11/2026 (ADR 0008) — giữ unlock, ambient(waves|rain|wind), chime, media,
   stopAll, fadeOut, vol, trần gain 0,5, mặc định 30, hẹn giờ trên đồng hồ âm thanh, nhỏ dần 10 s.
   Chỗ khác bản gốc: bỏ bum, giggle, melody (giai điệu tự tạo), muted/setMuted (công tắc chung của mục đếm).

   Quy tắc cứng:
   - KHÔNG tạo AudioContext lúc nạp trang. Chỉ unlock() (gọi trong handler của cú chạm "Phát", "Bắt đầu") mới tạo.
     chime() không tự tạo context (chỉ kêu khi người dùng đã bật tiếng bằng một cú chạm).
   - Âm tự tạo: thanh âm lượng 100 = gain 0,5; mặc định 30 (AC-53).
   - Mọi nguồn đang phát nằm trong `live`; stopAll(fadeMs ≤ 3000) nhỏ dần rồi tắt hết ("nặng lòng" gọi 800 ms, AC-45).
   - Hẹn giờ đặt trên đồng hồ âm thanh (ctx.currentTime): tab nền bị giãn timer vẫn tắt đúng giờ.
   - Không Web Speech, không tải file âm thanh nào cho âm tự tạo.

   Interface:
     SOUND.supported() → bool · SOUND.unlock() → ctx|null · SOUND.created() → bool · SOUND.vol(0..100) → gain
     SOUND.DEFAULT_VOLUME = 30 · SOUND.chime(freq, dur)
     SOUND.ambient(kind, {volume, minutes, onEnd}) → handle | null      kind: 'waves' | 'rain' | 'wind'
     SOUND.media(el, {onEnd}) → handle                                 <audio> giọng thật (night.js) để stopAll dừng chung
       handle = { kind, endsAt, setVolume(v), stop(fadeMs) }
     SOUND.stopAll(ms) · SOUND.fadeOut(ms) · SOUND.playing() → số nguồn đang phát
   ========================================================= */
window.HTDC_SOUND = (() => {
  'use strict';
  const GAIN_CAP = 0.5;          // thanh 100 → gain 0,5
  const DEFAULT_VOLUME = 30;     // AC-53
  const FADE_MAX = 3000;         // tắt hẳn trong ≤ 3 giây
  const END_FADE_S = 10;         // hết hẹn giờ: nhỏ dần ~10 giây (AC-48)
  const KINDS = ['waves', 'rain', 'wind'];

  let ctx = null;
  const live = new Set();

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const vol = v => clamp(+v || 0, 0, 100) / 100 * GAIN_CAP;
  const Ctor = () => (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
  const supported = () => !!Ctor();

  /* ===== Context: chỉ tạo khi có cú chạm ===== */
  function unlock() {
    if (!ctx) {
      const A = Ctor();
      if (!A) return null;
      try { ctx = new A(); } catch (e) { ctx = null; return null; }
      // Safari: âm "ambient" tôn trọng gạt im lặng của iPhone
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* bỏ qua */ }
    }
    if (ctx.state === 'suspended') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* bỏ qua */ } }
    return ctx;
  }

  /* ===== Tiếng chuông nhỏ (C3 hết lượt nói, A2) – chỉ dùng context đã có ===== */
  function chime(freq = 528, dur = 0.7) {
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* bỏ qua */ }
  }

  /* ===== Bộ đệm âm nền tự tạo: nhiễu nâu (sóng) / hồng (mưa, gió) 8 giây, nối vòng không "tách" ===== */
  function noiseBuffer(c, kind) {
    const len = c.sampleRate * 8, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'waves') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.06; }
    }
    // Kéo hai đầu bộ đệm về cùng mức để vòng lặp không có tiếng "tách"
    const drift = d[len - 1] - d[0];
    for (let i = 0; i < len; i++) d[i] -= drift * i / len;
    return buf;
  }

  /* ===== Âm nền: sóng biển, mưa nhẹ, gió êm ===== */
  function ambient(kind, opts = {}) {
    if (!KINDS.includes(kind)) kind = 'waves';
    const c = unlock();
    if (!c) return null;
    try {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, kind);
      src.loop = true;
      const filt = c.createBiquadFilter(), amp = c.createGain(), master = c.createGain();
      // Sóng: nhiễu nâu lọc thấp + lên xuống chậm. Mưa: nhiễu hồng dải giữa. Gió êm: nhiễu hồng lọc thấp, đều.
      filt.type = kind === 'rain' ? 'bandpass' : 'lowpass';
      filt.frequency.value = kind === 'rain' ? 2500 : kind === 'waves' ? 900 : 1400;
      filt.Q.value = 0.5;
      amp.gain.value = kind === 'waves' ? 0.6 : kind === 'wind' ? 1.4 : 1;
      master.gain.value = 0.0001;
      src.connect(filt).connect(amp).connect(master).connect(c.destination);
      let lfo = null;
      if (kind === 'waves') {
        lfo = c.createOscillator(); const depth = c.createGain();
        lfo.frequency.value = 0.09; depth.gain.value = 0.4;
        lfo.connect(depth).connect(amp.gain); lfo.start();
      }
      src.start();
      const now = c.currentTime;
      master.gain.setTargetAtTime(vol(opts.volume ?? DEFAULT_VOLUME), now, 1.2);
      const handle = { kind, endsAt: 0, stopped: false };
      // Hẹn giờ trên đồng hồ âm thanh: nhỏ dần 10 s cuối rồi dừng
      if (opts.minutes > 0) {
        const end = now + opts.minutes * 60;
        handle.endsAt = Date.now() + opts.minutes * 60000;
        master.gain.setTargetAtTime(0.0001, Math.max(now + 0.5, end - END_FADE_S), END_FADE_S / 4);
        src.stop(end + 0.2);
        if (lfo) lfo.stop(end + 0.2);
      }
      src.onended = () => {
        if (!live.has(handle)) return;
        live.delete(handle);
        handle.stopped = true;
        if (typeof opts.onEnd === 'function') { try { opts.onEnd(); } catch (e) { /* bỏ qua */ } }
      };
      handle.setVolume = v => {
        if (handle.stopped) return;
        try {
          master.gain.cancelScheduledValues(c.currentTime);
          master.gain.setTargetAtTime(vol(v), c.currentTime, 0.2);
          if (handle.endsAt) {
            const end = c.currentTime + (handle.endsAt - Date.now()) / 1000;
            master.gain.setTargetAtTime(0.0001, Math.max(c.currentTime + 0.5, end - END_FADE_S), END_FADE_S / 4);
          }
        } catch (e) { /* bỏ qua */ }
      };
      handle.stop = (fadeMs = 1500) => {
        if (handle.stopped) return;
        handle.stopped = true;
        live.delete(handle);
        const f = Math.max(0.05, clamp(fadeMs, 0, FADE_MAX) / 1000);
        try {
          const t = c.currentTime;
          master.gain.cancelScheduledValues(t);
          master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
          master.gain.exponentialRampToValueAtTime(0.0001, t + f);
          src.stop(t + f + 0.05);
          if (lfo) lfo.stop(t + f + 0.05);
        } catch (e) { try { src.stop(); } catch (e2) { /* bỏ qua */ } }
      };
      live.add(handle);
      return handle;
    } catch (e) { return null; }
  }

  /* ===== <audio> (file giọng thật ở assets/audio): đăng ký để nhỏ dần / dừng chung ===== */
  // iPhone không cho đổi volume của <audio> → nhỏ dần không được thì dừng hẳn
  function volumeWorks(el) {
    try { const old = el.volume, want = old > 0.5 ? 0.4 : 0.6; el.volume = want; const ok = Math.abs(el.volume - want) < 0.01; el.volume = old; return ok; } catch (e) { return false; }
  }
  function media(el, opts = {}) {
    const handle = { kind: 'media', endsAt: 0, stopped: false, el };
    const release = () => {
      try { el.pause(); } catch (e) { /* bỏ qua */ }
      try { el.removeAttribute('src'); el.load(); } catch (e) { /* bỏ qua */ }
    };
    handle.setVolume = v => { try { el.volume = clamp(+v || 0, 0, 100) / 100; } catch (e) { /* bỏ qua */ } };
    handle.stop = (fadeMs = 1500) => {
      if (handle.stopped) return;
      handle.stopped = true;
      live.delete(handle);
      const f = clamp(fadeMs, 0, FADE_MAX);
      if (!f || !volumeWorks(el)) { release(); return; }
      const v0 = el.volume, steps = Math.max(1, Math.round(f / 100));
      let i = 0;
      const id = setInterval(() => {
        i++;
        try { el.volume = Math.max(0, v0 * (1 - i / steps)); } catch (e) { /* bỏ qua */ }
        if (i >= steps) { clearInterval(id); release(); }
      }, 100);
    };
    handle.volumeWorks = () => volumeWorks(el);
    el.addEventListener('ended', () => {
      if (!live.has(handle)) return;
      live.delete(handle); handle.stopped = true;
      if (typeof opts.onEnd === 'function') { try { opts.onEnd(); } catch (e) { /* bỏ qua */ } }
    });
    live.add(handle);
    return handle;
  }

  /* ===== Dừng tất cả (≤ 3 s) ===== */
  function stopAll(fadeMs = 2000) {
    [...live].forEach(h => { try { h.stop(Math.min(fadeMs, FADE_MAX)); } catch (e) { /* bỏ qua */ } });
  }

  return {
    DEFAULT_VOLUME, GAIN_CAP, KINDS,
    supported, unlock, created: () => !!ctx, vol,
    chime, ambient, media,
    stopAll, fadeOut: ms => stopAll(ms),
    playing: () => live.size
  };
})();
