/* =========================================================
   GITARTHA BEATS — script.js
   All sounds are synthesized locally with the Web Audio API.
   No external assets, backend, or network calls are used.
   ========================================================= */

(function () {
  "use strict";

  /* ============================================================
     1. CONFIG — instrument + key definitions
     ============================================================ */

  // Percussion + voice row (documented controls)
  const PERC_INSTRUMENTS = [
    { key: "a", type: "bongo",      side: "left",  emoji: "🥁", label: "Bongo L" },
    { key: "d", type: "bongo",      side: "right", emoji: "🥁", label: "Bongo R" },
    { key: "c", type: "cymbal",     emoji: "🔔", label: "Cymbal" },
    { key: "f", type: "cowbell",    emoji: "🔔", label: "Cowbell" },
    { key: "b", type: "tambourine", emoji: "🎵", label: "Tambourine" },
    { key: " ", type: "meow",       emoji: "🐱", label: "Meow", display: "Space" }
  ];

  // Piano notes for number keys 1..0 (C4 up to E5)
  const PIANO_NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25];
  const PIANO_KEYS = "1234567890".split("");

  // Marimba notes for Q..P — pentatonic scale, distinct timbre from piano
  const MARIMBA_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
  const MARIMBA_KEYS = "qwertyuiop".split("");

  // build a fast lookup: key -> { type, freq?, side? }
  const KEY_MAP = {};
  PERC_INSTRUMENTS.forEach((inst) => { KEY_MAP[inst.key] = { type: inst.type, side: inst.side, label: inst.label, emoji: inst.emoji }; });
  PIANO_KEYS.forEach((k, i) => { KEY_MAP[k] = { type: "piano", freq: PIANO_NOTES[i], label: "Piano " + k, emoji: "🎹" }; });
  MARIMBA_KEYS.forEach((k, i) => { KEY_MAP[k] = { type: "marimba", freq: MARIMBA_NOTES[i], label: "Marimba " + k.toUpperCase(), emoji: "🎶" }; });

  /* ============================================================
     2. AUDIO ENGINE — everything synthesized, nothing downloaded
     ============================================================ */

  let audioCtx = null;
  let masterGain = null;
  let noiseBuffer = null; // reusable white-noise buffer
  let isMuted = false;
  let volumeBeforeMute = 0.8;

  function initAudio() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(audioCtx.destination);
    noiseBuffer = buildNoiseBuffer(1.0);
  }

  function resumeAudio() {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function buildNoiseBuffer(durationSec) {
    const length = Math.floor(audioCtx.sampleRate * durationSec);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function noiseSource() {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    return src;
  }

  // Generic percussive oscillator with a quick attack / exponential decay envelope
  function playOscHit({ freq = 440, type = "sine", duration = 0.25, gain = 0.7, glideTo = null, delay = 0 }) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) {
      osc.frequency.linearRampToValueAtTime(glideTo.freq, t0 + glideTo.time);
      if (glideTo.back) osc.frequency.linearRampToValueAtTime(freq, t0 + glideTo.time + glideTo.time);
    }
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function playNoiseHit({ duration = 0.25, gain = 0.5, filterType = "highpass", filterFreq = 6000, delay = 0 }) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + delay;
    const src = noiseSource();
    const filt = audioCtx.createBiquadFilter();
    const env = audioCtx.createGain();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filt).connect(env).connect(masterGain);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  // ---- specific instrument voices ----

  function soundBongo(side) {
    const freq = side === "left" ? 145 : 190;
    playOscHit({ freq, type: "sine", duration: 0.22, gain: 0.85 });
    playNoiseHit({ duration: 0.05, gain: 0.25, filterType: "bandpass", filterFreq: 900 });
  }

  function soundCymbal() {
    playNoiseHit({ duration: 0.9, gain: 0.45, filterType: "highpass", filterFreq: 5500 });
    playNoiseHit({ duration: 0.5, gain: 0.25, filterType: "highpass", filterFreq: 9000, delay: 0.01 });
  }

  function soundCowbell() {
    playOscHit({ freq: 587, type: "square", duration: 0.28, gain: 0.35 });
    playOscHit({ freq: 845, type: "square", duration: 0.24, gain: 0.3 });
  }

  function soundTambourine() {
    for (let i = 0; i < 3; i++) {
      playNoiseHit({ duration: 0.12, gain: 0.3, filterType: "bandpass", filterFreq: 8500, delay: i * 0.045 });
    }
    playOscHit({ freq: 2200, type: "triangle", duration: 0.1, gain: 0.15 });
  }

  function soundMeow() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(340, t0);
    osc.frequency.linearRampToValueAtTime(650, t0 + 0.12);
    osc.frequency.linearRampToValueAtTime(280, t0 + 0.32);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(0.4, t0 + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    const filt = audioCtx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 2200;
    osc.connect(filt).connect(env).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.45);
  }

  function soundPiano(freq) {
    playOscHit({ freq, type: "triangle", duration: 0.9, gain: 0.5 });
    playOscHit({ freq: freq * 2, type: "sine", duration: 0.5, gain: 0.12 });
  }

  function soundMarimba(freq) {
    playOscHit({ freq, type: "sine", duration: 0.45, gain: 0.55 });
    playOscHit({ freq: freq * 1.5, type: "sine", duration: 0.18, gain: 0.12 });
  }

  function soundGiggle() {
    // secret easter-egg sound
    for (let i = 0; i < 4; i++) {
      playOscHit({ freq: 500 + i * 90, type: "sine", duration: 0.12, gain: 0.35, delay: i * 0.08 });
    }
  }

  function soundYawn() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.linearRampToValueAtTime(140, t0 + 0.8);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(0.3, t0 + 0.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(env).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.95);
  }

  function playSoundFor(entry) {
    switch (entry.type) {
      case "bongo": soundBongo(entry.side); break;
      case "cymbal": soundCymbal(); break;
      case "cowbell": soundCowbell(); break;
      case "tambourine": soundTambourine(); break;
      case "meow": soundMeow(); break;
      case "piano": soundPiano(entry.freq); break;
      case "marimba": soundMarimba(entry.freq); break;
      default: break;
    }
  }

  /* ============================================================
     3. DOM REFERENCES
     ============================================================ */

  const characterEl = document.getElementById("character");
  const stageEl = document.getElementById("stage");
  const particlesEl = document.getElementById("particles");
  const comboBannerEl = document.getElementById("comboBanner");
  const nowPlayingEl = document.getElementById("nowPlaying");

  const muteBtn = document.getElementById("muteBtn");
  const muteIcon = document.getElementById("muteIcon");
  const volumeSlider = document.getElementById("volumeSlider");
  const fxToggle = document.getElementById("fxToggle");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const resetBtn = document.getElementById("resetBtn");

  const recBtn = document.getElementById("recBtn");
  const stopBtn = document.getElementById("stopBtn");
  const playBtn = document.getElementById("playBtn");
  const clearBtn = document.getElementById("clearBtn");
  const recStatusEl = document.getElementById("recStatus");

  const percButtonsEl = document.getElementById("percButtons");
  const pianoButtonsEl = document.getElementById("pianoButtons");
  const marimbaButtonsEl = document.getElementById("marimbaButtons");

  const startOverlay = document.getElementById("startOverlay");
  const startBtn = document.getElementById("startBtn");

  let fxEnabled = true;

  /* ============================================================
     4. BUILD ON-SCREEN BUTTONS FROM CONFIG
     ============================================================ */

  const KEY_COLORS = {
    bongo: "#f472b6", cymbal: "#38e1e6", cowbell: "#ffd166",
    tambourine: "#a78bfa", meow: "#fb7185", piano: "#7dd3fc", marimba: "#c4b5fd"
  };

  function makeButton(key, type, emoji, label, displayKey) {
    const btn = document.createElement("button");
    btn.className = "key-btn";
    btn.dataset.key = key;
    btn.style.setProperty("--k-color", KEY_COLORS[type] || "#a78bfa");
    btn.innerHTML =
      '<span class="key-btn__emoji">' + emoji + "</span>" +
      '<span class="key-btn__label">' + label + "</span>" +
      '<span class="key-btn__key">' + (displayKey || key.toUpperCase()) + "</span>";
    return btn;
  }

  PERC_INSTRUMENTS.forEach((inst) => {
    percButtonsEl.appendChild(makeButton(inst.key, inst.type, inst.emoji, inst.label, inst.display));
  });
  PIANO_KEYS.forEach((k) => {
    pianoButtonsEl.appendChild(makeButton(k, "piano", "🎹", "Note " + k, k));
  });
  MARIMBA_KEYS.forEach((k) => {
    marimbaButtonsEl.appendChild(makeButton(k, "marimba", "🎶", "Note " + k.toUpperCase(), k.toUpperCase()));
  });

  // quick lookup from key -> button element (keyboard highlight support)
  const BUTTON_BY_KEY = {};
  document.querySelectorAll(".key-btn").forEach((btn) => { BUTTON_BY_KEY[btn.dataset.key] = btn; });

  /* ============================================================
     5. CHARACTER ANIMATION
     ============================================================ */

  let animResetTimer = null;

  function animateCharacter(entry) {
    // clear conflicting classes then set relevant one(s) so animations can restart
    characterEl.classList.remove("hit-left", "hit-right", "head-bob", "bouncing", "singing", "mirror");
    void characterEl.offsetWidth; // force reflow so CSS animation restarts

    if (entry.type === "bongo") {
      characterEl.classList.add(entry.side === "left" ? "hit-left" : "hit-right");
      characterEl.classList.add("bouncing");
    } else if (entry.type === "cymbal" || entry.type === "tambourine") {
      characterEl.classList.add("hit-left", "hit-right", "head-bob", "bouncing");
    } else if (entry.type === "cowbell") {
      characterEl.classList.add(Math.random() > 0.5 ? "hit-left" : "hit-right", "bouncing");
    } else if (entry.type === "meow") {
      characterEl.classList.add("head-bob", "singing", "bouncing");
      triggerExcited(500);
    } else if (entry.type === "piano" || entry.type === "marimba") {
      const mirror = Math.random() > 0.5;
      if (mirror) characterEl.classList.add("mirror");
      characterEl.classList.add(mirror ? "hit-left" : "hit-right", "head-bob");
    }

    clearTimeout(animResetTimer);
    animResetTimer = setTimeout(() => {
      characterEl.classList.remove("singing");
    }, 500);
  }

  let excitedTimer = null;
  function triggerExcited(duration = 900) {
    characterEl.classList.add("excited");
    clearTimeout(excitedTimer);
    excitedTimer = setTimeout(() => characterEl.classList.remove("excited"), duration);
  }

  // idle blinking, fully independent of interaction
  function scheduleBlink() {
    const delay = 2200 + Math.random() * 2600;
    setTimeout(() => {
      characterEl.classList.add("blink");
      setTimeout(() => characterEl.classList.remove("blink"), 240);
      scheduleBlink();
    }, delay);
  }
  scheduleBlink();

  /* ============================================================
     6. VISUAL EFFECTS — particles & confetti
     ============================================================ */

  function spawnParticles(count, colors) {
    if (!fxEnabled) return;
    const rect = stageEl.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2 + 40;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const size = 6 + Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 90;
      p.style.width = size + "px";
      p.style.height = size + "px";
      p.style.left = cx + "px";
      p.style.top = cy + "px";
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      p.style.setProperty("--dy", Math.sin(angle) * dist - 30 + "px");
      particlesEl.appendChild(p);
      setTimeout(() => p.remove(), 950);
    }
  }

  function spawnConfetti(count = 40) {
    if (!fxEnabled) return;
    const colors = ["#a78bfa", "#f472b6", "#38e1e6", "#ffd166", "#fb7185", "#7dd3fc"];
    const rect = stageEl.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = Math.random() * rect.width + "px";
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = 0.9 + Math.random() * 0.9 + "s";
      c.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      particlesEl.appendChild(c);
      setTimeout(() => c.remove(), 2000);
    }
  }

  function colorsForType(type) {
    switch (type) {
      case "bongo": return ["#f472b6", "#fb7185"];
      case "cymbal": return ["#38e1e6", "#a5f3fc"];
      case "cowbell": return ["#ffd166", "#fde68a"];
      case "tambourine": return ["#a78bfa", "#c4b5fd"];
      case "meow": return ["#fb7185", "#fda4af"];
      case "piano": return ["#7dd3fc", "#bae6fd"];
      case "marimba": return ["#c4b5fd", "#ddd6fe"];
      default: return ["#a78bfa"];
    }
  }

  /* ============================================================
     7. COMBO SYSTEM
     ============================================================ */

  const MEOW_REACTIONS = [
    "MEOW MEOW!", "PURRFECT!", "CAT-TASTIC!", "SO FLUFFY!", "NICE ONE, WHISKERS!", "MEOWSIC TO MY EARS!"
  ];

  let pressHistory = []; // { key, time }
  let comboLockTimer = null;

  function showCombo(text) {
    comboBannerEl.textContent = text;
    comboBannerEl.classList.remove("show");
    void comboBannerEl.offsetWidth;
    comboBannerEl.classList.add("show");
    triggerExcited(1400);
    if (fxEnabled) spawnConfetti(50);
  }

  function checkCombos(key, now) {
    pressHistory.push({ key, time: now });
    // keep only recent history (last 2.5s)
    pressHistory = pressHistory.filter((p) => now - p.time <= 2500);

    const seq = pressHistory.map((p) => p.key);

    // Pattern: A D A D -> BONGO MASTER
    if (matchesTail(seq, ["a", "d", "a", "d"])) {
      showCombo("🥁 BONGO MASTER! 🥁");
      pressHistory = [];
      return;
    }

    // Pattern: C F C -> CHAOS
    if (matchesTail(seq, ["c", "f", "c"])) {
      showCombo("🌪️ CHAOS! 🌪️");
      pressHistory = [];
      return;
    }

    // Rapid presses -> INSANE MODE (8+ presses inside 1.1s)
    const recentFast = pressHistory.filter((p) => now - p.time <= 1100);
    if (recentFast.length >= 8) {
      showCombo("⚡ INSANE MODE! ⚡");
      pressHistory = [];
      return;
    }

    // Ascending marimba scale Q W E R T Y U I O P -> VIRTUOSO
    if (matchesTail(seq, MARIMBA_KEYS)) {
      showCombo("🎻 VIRTUOSO! 🎻");
      pressHistory = [];
      return;
    }

    // Space -> random funny reaction (not a "combo" lock, just a fun message)
    if (key === " ") {
      const msg = MEOW_REACTIONS[Math.floor(Math.random() * MEOW_REACTIONS.length)];
      showCombo(msg);
    }
  }

  function matchesTail(seq, pattern) {
    if (seq.length < pattern.length) return false;
    const tail = seq.slice(seq.length - pattern.length);
    return tail.every((v, i) => v === pattern[i]);
  }

  // secret: press "0" three times fast -> MIC DROP
  let zeroPressTimes = [];
  function checkMicDrop(key, now) {
    if (key !== "0") return;
    zeroPressTimes.push(now);
    zeroPressTimes = zeroPressTimes.filter((t) => now - t <= 900);
    if (zeroPressTimes.length >= 3) {
      showCombo("🎤 MIC DROP! 🎤");
      zeroPressTimes = [];
    }
  }

  /* ============================================================
     8. LOOP RECORDER
     ============================================================ */

  let isRecording = false;
  let isPlaying = false;
  let recordStartTime = 0;
  let recordedEvents = []; // { key, t }
  let playbackTimers = [];

  function startRecording() {
    resumeAudio();
    stopPlayback();
    isRecording = true;
    recordedEvents = [];
    recordStartTime = performance.now();
    recBtn.classList.add("is-recording");
    recStatusEl.textContent = "● Recording... play some beats!";
  }

  function stopRecording() {
    isRecording = false;
    recBtn.classList.remove("is-recording");
    recStatusEl.textContent = recordedEvents.length
      ? "Captured " + recordedEvents.length + " notes — press Play to hear it!"
      : "Nothing captured yet.";
  }

  function stopPlayback() {
    playbackTimers.forEach((id) => clearTimeout(id));
    playbackTimers = [];
    isPlaying = false;
    playBtn.classList.remove("is-playing");
  }

  function playLoop() {
    if (!recordedEvents.length) {
      recStatusEl.textContent = "Nothing to play — record a loop first!";
      return;
    }
    resumeAudio();
    stopPlayback();
    isPlaying = true;
    playBtn.classList.add("is-playing");
    recStatusEl.textContent = "▶ Playing your loop...";

    recordedEvents.forEach((ev) => {
      const id = setTimeout(() => {
        triggerKey(ev.key, { fromPlayback: true });
      }, ev.t);
      playbackTimers.push(id);
    });

    const totalDuration = recordedEvents[recordedEvents.length - 1].t + 500;
    const endId = setTimeout(() => {
      isPlaying = false;
      playBtn.classList.remove("is-playing");
      recStatusEl.textContent = "Loop finished. Press Play to hear it again!";
    }, totalDuration);
    playbackTimers.push(endId);
  }

  function clearLoop() {
    stopPlayback();
    stopRecording();
    recordedEvents = [];
    recStatusEl.textContent = "Idle — press Record to capture a loop";
  }

  /* ============================================================
     9. CORE TRIGGER — wires sound + animation + fx + highlight
     ============================================================ */

  let lastTriggerTime = 0;

  function highlightKey(key) {
    const btn = BUTTON_BY_KEY[key];
    if (!btn) return;
    btn.classList.add("is-pressed");
    setTimeout(() => btn.classList.remove("is-pressed"), 160);
  }

  function showNowPlaying(entry) {
    if (!entry.label) return;
    nowPlayingEl.textContent = entry.emoji + " " + entry.label;
    clearTimeout(showNowPlaying._t);
    showNowPlaying._t = setTimeout(() => { nowPlayingEl.textContent = ""; }, 900);
  }

  function triggerKey(key, opts) {
    opts = opts || {};
    const entry = KEY_MAP[key];
    if (!entry) return;

    initAudio();
    resumeAudio();

    playSoundFor(entry);
    animateCharacter(entry);
    highlightKey(key);
    showNowPlaying(entry);
    spawnParticles(10, colorsForType(entry.type));
    vibrate(18);

    const now = performance.now();
    lastTriggerTime = now;

    if (!opts.fromPlayback) {
      checkCombos(key, now);
      checkMicDrop(key, now);

      if (isRecording) {
        recordedEvents.push({ key, t: Math.round(now - recordStartTime) });
      }
    }
  }

  function vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore - vibration unsupported */ }
  }

  /* ============================================================
     10. EVENT WIRING — keyboard + on-screen buttons
     ============================================================ */

  document.addEventListener("keydown", (e) => {
    if (e.repeat) return; // ignore key auto-repeat while held
    const key = e.key.toLowerCase();
    if (!KEY_MAP[key]) return;
    e.preventDefault();
    hideStartOverlay();
    triggerKey(key);
  });

  document.querySelectorAll(".key-btn").forEach((btn) => {
    const key = btn.dataset.key;
    btn.addEventListener("click", () => {
      hideStartOverlay();
      triggerKey(key);
    });
  });

  // secret: click the character directly -> giggle + spin (not documented in UI)
  characterEl.addEventListener("click", (e) => {
    e.stopPropagation();
    hideStartOverlay();
    initAudio();
    resumeAudio();
    soundGiggle();
    triggerExcited(700);
    characterEl.classList.add("bouncing", "head-bob");
    setTimeout(() => characterEl.classList.remove("bouncing", "head-bob"), 500);
    spawnParticles(14, ["#ffd166", "#f472b6", "#38e1e6"]);
    vibrate(25);
  });

  // secret: triple-click the footer brand -> disco mode
  let brandClicks = [];
  document.querySelector(".footer__brand").addEventListener("click", () => {
    const now = performance.now();
    brandClicks.push(now);
    brandClicks = brandClicks.filter((t) => now - t < 900);
    if (brandClicks.length >= 3) {
      document.body.classList.toggle("disco");
      brandClicks = [];
    }
  });

  // secret: hold Space > 1.1s -> sleepy yawn
  let spaceHoldTimer = null;
  document.addEventListener("keydown", (e) => {
    if (e.key === " " && !spaceHoldTimer && !e.repeat) {
      spaceHoldTimer = setTimeout(() => {
        characterEl.classList.add("sleepy");
        initAudio(); resumeAudio();
        soundYawn();
        showCombo("😴 SLEEPY CAT...");
      }, 1100);
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === " ") {
      clearTimeout(spaceHoldTimer);
      spaceHoldTimer = null;
      characterEl.classList.remove("sleepy");
    }
  });

  /* ============================================================
     11. TOP-BAR CONTROLS
     ============================================================ */

  volumeSlider.addEventListener("input", () => {
    const v = Number(volumeSlider.value) / 100;
    volumeBeforeMute = v;
    if (masterGain) masterGain.gain.value = isMuted ? 0 : v;
    if (v === 0 && !isMuted) setMuted(true, true);
    if (v > 0 && isMuted) setMuted(false, true);
  });

  function setMuted(muted, silent) {
    isMuted = muted;
    muteIcon.textContent = muted ? "🔇" : "🔊";
    muteBtn.classList.toggle("is-muted", muted);
    if (masterGain) masterGain.gain.value = muted ? 0 : Number(volumeSlider.value) / 100;
    if (!silent && !muted && Number(volumeSlider.value) === 0) {
      volumeSlider.value = 80;
      volumeBeforeMute = 0.8;
      if (masterGain) masterGain.gain.value = 0.8;
    }
  }

  muteBtn.addEventListener("click", () => {
    initAudio();
    setMuted(!isMuted);
  });

  fxToggle.addEventListener("click", () => {
    fxEnabled = !fxEnabled;
    fxToggle.classList.toggle("is-active", fxEnabled);
  });

  fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  resetBtn.addEventListener("click", () => {
    clearLoop();
    pressHistory = [];
    zeroPressTimes = [];
    brandClicks = [];
    document.body.classList.remove("disco");
    characterEl.classList.remove("excited", "sleepy", "bouncing", "hit-left", "hit-right", "head-bob", "singing", "mirror");
    volumeSlider.value = 80;
    volumeBeforeMute = 0.8;
    setMuted(false, true);
    fxEnabled = true;
    fxToggle.classList.add("is-active");
    particlesEl.innerHTML = "";
    comboBannerEl.classList.remove("show");
    nowPlayingEl.textContent = "";
    recStatusEl.textContent = "Idle — press Record to capture a loop";
  });

  /* ============================================================
     12. RECORDER CONTROLS
     ============================================================ */

  recBtn.addEventListener("click", () => { initAudio(); resumeAudio(); startRecording(); });
  stopBtn.addEventListener("click", () => { if (isRecording) stopRecording(); else stopPlayback(); });
  playBtn.addEventListener("click", () => { if (isRecording) stopRecording(); playLoop(); });
  clearBtn.addEventListener("click", clearLoop);

  /* ============================================================
     13. START OVERLAY — first gesture unlocks audio (autoplay policy)
     ============================================================ */

  function hideStartOverlay() {
    if (!startOverlay.classList.contains("hidden")) {
      startOverlay.classList.add("hidden");
    }
    initAudio();
    resumeAudio();
  }

  startBtn.addEventListener("click", hideStartOverlay);
  startOverlay.addEventListener("click", (e) => {
    if (e.target === startOverlay) hideStartOverlay();
  });

  // any first tap anywhere also counts as the unlocking gesture
  document.body.addEventListener("pointerdown", function firstTouch() {
    hideStartOverlay();
  }, { once: true });

})();
