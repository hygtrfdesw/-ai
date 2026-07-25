const subtitle = document.querySelector("#subtitle");
const chatLog = document.querySelector("#chatLog");
const composer = document.querySelector("#composer");
const input = document.querySelector("#messageInput");
const moodPill = document.querySelector("#moodPill");
const moodButton = document.querySelector("#moodButton");
const homeKey = document.querySelector("#homeKey");
const clock = document.querySelector("#clock");
const memoryCards = document.querySelectorAll(".memory-card");
const locateButton = document.querySelector("#locateButton");
const locationTitle = document.querySelector("#locationTitle");
const locationDetail = document.querySelector("#locationDetail");
const soundButton = document.querySelector("#soundButton");
const voiceTestButton = document.querySelector("#voiceTestButton");
const eyeButton = document.querySelector("#eyeButton");
const listenButton = document.querySelector("#listenButton");
const voiceSelect = document.querySelector("#voiceSelect");
const sendButton = document.querySelector("#sendButton");
const systemState = document.querySelector("#systemState");
const offlineState = document.querySelector("#offlineState");
const voiceBars = document.querySelectorAll(".voice-wave span");
const characterVideo = document.querySelector("#characterVideo");
const appConfig = window.LINGYU_CONFIG || {};

function apiUrl(path) {
  const configuredBase = String(appConfig.apiBase || localStorage.getItem("lingyu_api_base") || "").replace(/\/$/, "");
  return configuredBase ? `${configuredBase}${path}` : path;
}

const uiText = {
  subtitle: "\u9017\u4f60\u7684\u5566",
  soundOff: "\u58f0\u97f3\u5173",
  soundOn: "\u58f0\u97f3\u5f00",
  locate: "\u5b9a\u4f4d",
  locating: "\u68c0\u6d4b\u4e2d",
  eye: "\u773c\u775b",
  eyeOn: "\u770b\u89c1",
  listen: "\u542c\u89c9",
  listening: "\u542c\u4e2d",
  test: "\u8bd5\u542c",
  send: "\u53d1\u9001",
  placeholder: "\u548c\u5979\u8bf4\u4e00\u53e5\u8bdd",
  standby: "\u79bb\u7ebf\u6838\u5fc3\u5f85\u673a",
  checking: "\u68c0\u6d4b\u7f51\u7edc\u4e2d"
};

const moods = [
  { name: "温柔 / 清醒", line: "我在。你说慢一点，我会听。" },
  { name: "俏皮 / 认真", line: "逗你的啦。不过这次我会认真回答。" },
  { name: "守护 / 有边界", line: "我会陪你，但不会替你做决定。" }
];

const fallbackReplies = [
  "我听懂了。但我不完全同意，你这句话有点太绝对。",
  "先别急着下结论。把事情拆小一点看，会更清楚。",
  "我会陪你，但我不会只顺着你说。",
  "这件事可以说，但不能糊弄过去。你真正担心的是哪一部分？"
];

let moodIndex = 1;
let soundEnabled = false;
let audioContext;
let selectedVoice;
let clonedAudio;
let voiceRunId = 0;
let audioUnlocked = false;
let chatHistory = JSON.parse(localStorage.getItem("lingyu_chat_history") || "[]");
let memories = JSON.parse(localStorage.getItem("lingyu_memory") || "[]");
let userId = localStorage.getItem("lingyu_user_id");
let currentLocation = JSON.parse(localStorage.getItem("lingyu_location") || "null");
let cameraStream;
let cameraVideo;
let microphoneStream;
let activeAudioCapture;
let isListening = false;
let recognition;
let voiceChatEnabled = true;
let voiceOutputActive = false;
let voiceRestartTimer;
let lastInteractionAt = Date.now();
let isThinking = false;
let backgroundThinking = false;
let latestUserTurn = 0;
let subtitleQueue = [];
let subtitlePlaying = false;
let subtitleTimer;
let typeTimer;
let subtitleRunId = 0;
let builtInStarted = false;
let builtInBooting = false;

if (!userId) {
  userId = crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("lingyu_user_id", userId);
}

function initText() {
  subtitle.textContent = uiText.subtitle;
  soundButton.textContent = uiText.soundOff;
  locateButton.textContent = uiText.locate;
  eyeButton.textContent = uiText.eye;
  listenButton.textContent = uiText.listen;
  voiceTestButton.textContent = uiText.test;
  sendButton.textContent = uiText.send;
  input.placeholder = uiText.placeholder;
  systemState.textContent = uiText.standby;
  offlineState.textContent = uiText.checking;
  moodPill.textContent = moods[moodIndex].name;
  const prompts = ["今天你会陪我吗？", "你记得我上次说的话吗？", "如果我难过，你会怎么做？"];
  memoryCards.forEach((card, index) => {
    card.dataset.prompt = prompts[index] || "";
  });
}

function setClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function tone(frequency = 620, duration = 0.08, type = "sine", gainValue = 0.035) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
}

function bootSound() {
  [520, 680, 860, 1040].forEach((freq, index) => {
    window.setTimeout(() => tone(freq, 0.09, "triangle", 0.045), index * 90);
  });
}

function renderVoiceOptions(voices) {
  if (!voiceSelect) return;
  const chosen = localStorage.getItem("lingyu_voice");
  voiceSelect.innerHTML = "";
  voices
    .filter((voice) => voice.lang.includes("zh") || voice.lang.includes("en"))
    .forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})${voice.localService ? " 离线" : ""}`;
      voiceSelect.appendChild(option);
    });
  voiceSelect.value = chosen || selectedVoice?.name || voiceSelect.options[0]?.value || "";
}

function setVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const chosenName = localStorage.getItem("lingyu_voice");
  selectedVoice =
    voices.find((voice) => voice.name === chosenName) ||
    voices.find((voice) => voice.lang.includes("zh") && voice.localService) ||
    voices.find((voice) => voice.lang.includes("zh")) ||
    voices[0];
  renderVoiceOptions(voices);
}

function pulseVoice(active) {
  voiceBars.forEach((bar, index) => {
    bar.style.animationPlayState = active ? "running" : "paused";
    bar.style.animationDelay = `${index * 70}ms`;
  });
  document.body.classList.toggle("is-speaking", active);
}

function syncMotionState() {
  document.body.classList.toggle("is-thinking", isThinking || backgroundThinking);
}

function syncListeningState() {
  document.body.classList.toggle("is-listening", isListening);
  if (isListening) {
    listenButton.textContent = uiText.listening;
    listenButton.classList.add("active");
  } else {
    listenButton.textContent = uiText.listen;
    listenButton.classList.remove("active");
  }
}

function pauseRecognitionForOutput() {
  window.clearTimeout(voiceRestartTimer);
  stopActiveAudioCapture();
  if (recognition && isListening) {
    try {
      recognition.stop();
    } catch {}
  }
}

function scheduleVoiceChatRestart(delay = 650) {
  window.clearTimeout(voiceRestartTimer);
  if (!voiceChatEnabled) return;
  voiceRestartTimer = window.setTimeout(() => {
    if (!voiceChatEnabled || document.hidden || isThinking || voiceOutputActive || !microphoneStream) return;
    startBuiltInRecognition();
  }, delay);
}

function cleanTextForDialogue(text) {
  const actionWords = [
    "沉默", "停顿", "顿了顿", "顿一顿", "停了一下", "停了两秒", "沉默了两秒", "安静",
    "叹了口气", "笑了一下", "叹气", "笑了", "轻笑", "苦笑", "皱眉", "挑眉", "眨眼",
    "看了你一眼", "看了你", "看向你", "看一眼", "看你", "低头", "抬头", "靠近", "靠着", "抱臂",
    "搭了搭手", "摊手", "摆手", "伸手", "拍了拍", "摸头", "揉头",
    "打字", "删掉", "想了想", "愣住", "转移话题"
  ].join("|");
  const actionPattern = new RegExp(actionWords);
  return String(text || "")
    .split(/\n+/)
    .map((line) => {
      let value = line
        .replace(/[（(【\[][^\n）)】\]]*[）)】\]]/g, "")
        .replace(/^[“”"「」『』]*[（(【\[][^\n）)】\]]*[）)】\]][“”"「」『』]*$/g, "")
        .replace(/[*_~·]+/g, "")
        .trim();
      if (!value) return "";
      const colonIndex = Math.max(value.lastIndexOf("："), value.lastIndexOf(":"));
      if (colonIndex >= 0 && actionPattern.test(value.slice(0, colonIndex))) {
        value = value.slice(colonIndex + 1).trim();
      }
      value = value
        .replace(new RegExp(`^(?:(?:屿|他|她|我)\\s*)?(?:${actionWords})(?:了)?(?:一会儿|一下|几秒|两秒|三秒|半天)?[，,。.!！?？：:；;、\\s]*`, "g"), "")
        .replace(/[“”"「」『』]/g, "")
        .trim();
      const pureAction = new RegExp(`^(?:(?:屿|他|她|我)\\s*)?(?:${actionWords})(?:了)?(?:一会儿|一下|几秒|两秒|三秒|半天)?[。.!！?？]?$`);
      return pureAction.test(value) ? "" : value;
    })
    .filter(Boolean)
    .join(" ")
    .replace(/^\s*[·*~-]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function splitVoiceSegments(text) {
  const source = String(text || "")
    .replace(/[…]+/g, "。")
    .replace(/\.{2,}/g, "。")
    .replace(/\s+/g, " ")
    .trim();
  if (!source) return [];
  const rough = source
    .split(/(?<=[。！？!?，,；;])/)
    .map((item) => item.trim())
    .filter(Boolean);
  const segments = [];
  for (const part of rough.length ? rough : [source]) {
    let rest = part;
    while (rest.length > 24) {
      const cutAt = Math.max(
        rest.lastIndexOf("，", 24),
        rest.lastIndexOf(",", 24),
        rest.lastIndexOf("、", 24)
      );
      const index = cutAt > 8 ? cutAt + 1 : 24;
      segments.push(rest.slice(0, index).trim());
      rest = rest.slice(index).trim();
    }
    if (rest) segments.push(rest);
  }
  return segments.slice(0, 12);
}

function pauseAfterVoiceSegment(segment) {
  if (/[！？!?]$/.test(segment)) return 260 + Math.random() * 160;
  if (/[。；;]$/.test(segment)) return 220 + Math.random() * 140;
  if (/[，,、]$/.test(segment)) return 120 + Math.random() * 90;
  return 150 + Math.random() * 100;
}

async function playClonedVoice(text, runId) {
  if (runId !== voiceRunId) return;
  const response = await fetch(apiUrl("/api/tts"), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text, userId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.audio) throw new Error(data.error || "TTS unavailable");
  if (runId !== voiceRunId) return;
  if (clonedAudio) {
    clonedAudio.pause();
    clonedAudio.currentTime = 0;
  }
  clonedAudio = new Audio(data.audio);
  clonedAudio.volume = 1;
  clonedAudio.onplay = () => pulseVoice(true);
  const ended = new Promise((resolve, reject) => {
    clonedAudio.onended = () => {
      pulseVoice(false);
      resolve();
    };
    clonedAudio.onerror = () => {
      systemState.textContent = "克隆音色播放失败";
      pulseVoice(false);
      reject(new Error("audio playback failed"));
    };
  });
  await clonedAudio.play();
  systemState.textContent = "克隆音色播放中";
  await ended;
}

function sayWithSystemVoice(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  setVoice();
  const utterance = new SpeechSynthesisUtterance(cleanTextForDialogue(text));
  utterance.lang = "zh-CN";
  utterance.voice = selectedVoice || null;
  utterance.pitch = 1.08;
  utterance.rate = 0.98;
  utterance.volume = 0.95;
  utterance.onstart = () => pulseVoice(true);
  utterance.onend = () => pulseVoice(false);
  utterance.onerror = () => pulseVoice(false);
  window.speechSynthesis.speak(utterance);
}

function say(text) {
  if (!soundEnabled) return;
  const voiceText = cleanTextForDialogue(text);
  if (!voiceText) return;
  const runId = ++voiceRunId;
  voiceOutputActive = true;
  pauseRecognitionForOutput();
  if (clonedAudio) {
    clonedAudio.pause();
    clonedAudio.currentTime = 0;
  }
  playNaturalVoice(voiceText, runId).catch((error) => {
    systemState.textContent = `克隆音色播放失败`;
    console.warn("Cloned voice failed:", error);
  });
}

async function playNaturalVoice(text, runId) {
  try {
    const segments = splitVoiceSegments(text);
    if (!segments.length) return;
    for (const segment of segments) {
      if (runId !== voiceRunId) return;
      await playClonedVoice(segment, runId);
      if (runId !== voiceRunId) return;
      await wait(pauseAfterVoiceSegment(segment));
    }
  } finally {
    if (runId === voiceRunId) {
      pulseVoice(false);
      voiceOutputActive = false;
      scheduleVoiceChatRestart(500);
    }
  }
}

function splitSubtitle(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean
    .split(/(?<=[。！？!?，,])/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks = [];
  for (const part of parts.length ? parts : [clean]) {
    let rest = part;
    while (rest.length > 12) {
      chunks.push(rest.slice(0, 12));
      rest = rest.slice(12);
    }
    if (rest) chunks.push(rest);
  }
  return chunks.slice(0, 8);
}

function showSubtitleSequence(text) {
  window.clearTimeout(subtitleTimer);
  window.clearTimeout(typeTimer);
  subtitleRunId += 1;
  const runId = subtitleRunId;
  subtitleQueue = splitSubtitle(text);
  subtitle.textContent = "";
  subtitle.classList.remove("is-typing");
  if (!subtitleQueue.length) return;
  subtitlePlaying = true;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const typeLine = (line, done) => {
    if (reducedMotion) {
      subtitle.textContent = line;
      done();
      return;
    }
    subtitle.classList.add("is-typing");
    subtitle.textContent = "";
    let index = 0;
    const step = () => {
      if (runId !== subtitleRunId) return;
      index += 1;
      subtitle.textContent = line.slice(0, index);
      if (index < line.length) {
        const char = line[index - 1] || "";
        const delay = /[。！？!?，,]/.test(char) ? 120 : 38 + Math.random() * 34;
        typeTimer = window.setTimeout(step, delay);
        return;
      }
      subtitle.classList.remove("is-typing");
      done();
    };
    step();
  };

  const next = () => {
    if (runId !== subtitleRunId) return;
    const line = subtitleQueue.shift();
    if (!line) {
      subtitlePlaying = false;
      subtitle.classList.remove("is-typing");
      return;
    }
    typeLine(line, () => {
      if (runId !== subtitleRunId) return;
      subtitleTimer = window.setTimeout(next, Math.max(760, Math.min(1800, line.length * 82)));
    });
  };
  next();
}

function addBubble(text, who = "ai") {
  if (!chatLog) return;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${who}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function saveState() {
  chatHistory = chatHistory.slice(-20);
  memories = memories.slice(-24);
  localStorage.setItem("lingyu_chat_history", JSON.stringify(chatHistory));
  localStorage.setItem("lingyu_memory", JSON.stringify(memories));
}

function rememberFrom(text) {
  const rules = [
    /我喜欢(.{1,18})/,
    /我讨厌(.{1,18})/,
    /记住(.{1,28})/,
    /以后(.{1,28})/,
    /我的名字是(.{1,12})/
  ];
  const hit = rules.map((rule) => text.match(rule)?.[0]).find(Boolean);
  if (hit && !memories.includes(hit)) {
    memories.push(hit);
    saveState();
  }
}

function memorySummary() {
  if (!memories.length) return "暂无长期记忆。";
  return memories.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function normalizeForRepeat(text) {
  return String(text || "")
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")
    .trim();
}

function similarityScore(a, b) {
  const left = normalizeForRepeat(a);
  const right = normalizeForRepeat(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const short = left.length <= right.length ? left : right;
  const long = left.length > right.length ? left : right;
  if (long.includes(short) && short.length >= 6) return short.length / long.length;
  const grams = (value) => {
    const set = new Set();
    for (let index = 0; index < value.length - 1; index += 1) set.add(value.slice(index, index + 2));
    return set;
  };
  const aSet = grams(left);
  const bSet = grams(right);
  if (!aSet.size || !bSet.size) return 0;
  let overlap = 0;
  aSet.forEach((gram) => {
    if (bSet.has(gram)) overlap += 1;
  });
  return overlap / Math.max(aSet.size, bSet.size);
}

function isTooSimilarToRecentAi(text) {
  const recentAi = chatHistory.filter((item) => item.role === "assistant").slice(-4);
  return recentAi.some((item) => similarityScore(text, item.content) >= 0.72);
}

function localReply(text) {
  const memoryHint = memories.length ? `我还记得：${memories.slice(-2).join("；")}。` : "";
  if (/永远|必须|所有人|没人|一定|绝对/.test(text)) {
    return `我反驳一句：你用了太绝对的词。${memoryHint}先把范围缩小，答案会靠谱很多。`;
  }
  if (/难过|烦|崩溃|不想|累/.test(text)) {
    return `我听出来你不舒服。${memoryHint}但别急着否定自己，先说最压着你的那一件事。`;
  }
  if (/定位|位置|在哪/.test(text)) {
    return "定位要你主动授权。我可以帮你看状态，但不会偷偷拿你的位置。";
  }
  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

function touchInteraction() {
  lastInteractionAt = Date.now();
}

async function captureVisionFrame() {
  if (!cameraVideo || !cameraStream) return null;
  const width = cameraVideo.videoWidth || 480;
  const height = cameraVideo.videoHeight || 360;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 640 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function preferredAudioMimeType() {
  if (!window.MediaRecorder) return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function audioFormatFromMime(mimeType = "") {
  const value = mimeType.toLowerCase();
  if (value.includes("webm")) return "webm";
  if (value.includes("ogg")) return "ogg";
  if (value.includes("mp4")) return "mp4";
  if (value.includes("mpeg")) return "mp3";
  return "";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function startAudioCapture() {
  if (!microphoneStream || !window.MediaRecorder) return null;
  const chunks = [];
  const mimeType = preferredAudioMimeType();
  const recorder = new MediaRecorder(microphoneStream, mimeType ? { mimeType } : undefined);
  let stopped = false;
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  recorder.start();
  const stop = () => new Promise((resolve) => {
    if (stopped) {
      resolve(null);
      return;
    }
    stopped = true;
    const finish = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (!blob.size) {
        resolve(null);
        return;
      }
      const dataUrl = await blobToDataUrl(blob).catch(() => "");
      resolve(dataUrl ? { audioData: dataUrl, audioFormat: audioFormatFromMime(blob.type) } : null);
    };
    recorder.onstop = finish;
    try {
      recorder.stop();
    } catch {
      finish();
    }
  });
  return { stop };
}

async function stopActiveAudioCapture() {
  const capture = activeAudioCapture;
  activeAudioCapture = null;
  return capture ? capture.stop() : null;
}

async function askDoubao(text, options = {}) {
  const visionImage = options.visionImage || await captureVisionFrame();
  const message = options.avoidRepeat
    ? `${text}\n\n别重复你刚才或最近说过的话，换一个新的说法。只说台词。`
    : text;
  const response = await fetch(apiUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      message,
      userId,
      memory: memorySummary(),
      messages: options.messages || chatHistory.slice(-6),
      location: currentLocation,
      visionImage,
      audioData: options.audioData || null,
      audioFormat: options.audioFormat || "",
      source: options.source || "typed"
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Doubao request failed");
  if (Array.isArray(data.memories)) {
    memories = data.memories.slice(-24);
    saveState();
  }
  return data.reply;
}

async function loadServerMemory() {
  try {
    const response = await fetch(apiUrl(`/api/memory?userId=${encodeURIComponent(userId)}`));
    const data = await response.json();
    if (Array.isArray(data.facts) && data.facts.length) {
      memories = Array.from(new Set([...memories, ...data.facts])).slice(-24);
      saveState();
    }
  } catch {
    // Local memory still works when offline.
  }
}

function speak(text) {
  const dialogue = cleanTextForDialogue(text);
  if (!dialogue) return;
  showSubtitleSequence(dialogue);
  addBubble(dialogue, "ai");
  chatHistory.push({ role: "assistant", content: dialogue });
  saveState();
  tone(720, 0.045, "sine", 0.018);
  say(dialogue);
}

function cycleMood() {
  tone(460, 0.07, "square", 0.018);
  moodIndex = (moodIndex + 1) % moods.length;
  moodPill.textContent = moods[moodIndex].name;
  systemState.textContent = `情绪：${moods[moodIndex].name}`;
  speak(moods[moodIndex].line);
}

function enableSound() {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? uiText.soundOn : uiText.soundOff;
  soundButton.classList.toggle("active", soundEnabled);

  if (soundEnabled) {
    getAudioContext().resume();
    audioUnlocked = true;
    bootSound();
    systemState.textContent = "声音已解锁";
    speak("语音系统启动。现在我会出声回答。");
  } else {
    audioUnlocked = false;
    voiceRunId += 1;
    if (clonedAudio) clonedAudio.pause();
    window.speechSynthesis?.cancel?.();
    pulseVoice(false);
  }
}

memoryCards.forEach((card) => {
  card.addEventListener("click", () => {
    tone(540, 0.045, "triangle", 0.02);
    memoryCards.forEach((item) => item.classList.remove("active"));
    card.classList.add("active");
    input.value = card.dataset.prompt || "";
    input.focus();
  });
});

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  sendMessage(text, "typed");
});

moodButton.addEventListener("click", cycleMood);
soundButton.addEventListener("click", enableSound);
voiceTestButton.addEventListener("click", () => {
  if (!soundEnabled) enableSound();
  speak("这是我克隆后的声音。你听一下像不像。");
});
eyeButton.addEventListener("click", async () => {
  touchInteraction();
  if (!navigator.mediaDevices?.getUserMedia) {
    speak("这个浏览器没有摄像头权限接口，我暂时看不见。");
    return;
  }

  if (!cameraStream) {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      cameraVideo = document.createElement("video");
      cameraVideo.muted = true;
      cameraVideo.playsInline = true;
      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play();
      eyeButton.textContent = uiText.eyeOn;
      eyeButton.classList.add("active");
      speak("眼睛打开了。你让我看的时候，我会看一眼。");
    } catch {
      speak("你没有给摄像头权限，所以我还看不见。");
    }
    return;
  }

  const visionImage = await captureVisionFrame();
  if (!visionImage) {
    speak("我看到了画面，但还没抓稳。再点一次眼睛。");
    return;
  }

  systemState.textContent = "正在看";
  subtitle.textContent = "我看一眼。";
  const visionStartedAt = lastInteractionAt;
  backgroundThinking = true;
  syncMotionState();
  askDoubao("看一下我面前的画面，用一句话告诉我你注意到了什么。", { visionImage, source: "vision" })
    .then((reply) => {
      if (!isThinking && lastInteractionAt === visionStartedAt) speak(reply);
    })
    .catch(() => {
      if (!isThinking && lastInteractionAt === visionStartedAt) speak("我现在看不清，但摄像头已经打开了。");
    })
    .finally(() => {
      if (!isThinking) systemState.textContent = "在线";
      backgroundThinking = false;
      syncMotionState();
    });
});

listenButton.addEventListener("click", () => {
  touchInteraction();
  voiceChatEnabled = true;
  requestBuiltInVoice();
});
voiceSelect.addEventListener("change", () => {
  localStorage.setItem("lingyu_voice", voiceSelect.value);
  setVoice();
  speak("语音已切换。");
});
homeKey.addEventListener("click", () => {
  bootSound();
  speak("启动完成。聆屿在这里。");
});

locateButton.addEventListener("click", () => {
  touchInteraction();
  tone(780, 0.06, "sawtooth", 0.02);
  if (!("geolocation" in navigator)) {
    locationTitle.textContent = "设备不支持定位";
    locationDetail.textContent = "当前浏览器没有提供定位接口。";
    speak("我没有拿到定位能力，但仍然可以陪你。");
    return;
  }

  locateButton.disabled = true;
  locateButton.textContent = uiText.locating;
  locationTitle.textContent = "正在检测位置";
  locationDetail.textContent = "等待浏览器授权和定位结果。";
  systemState.textContent = "定位扫描中";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const lat = latitude.toFixed(5);
      const lon = longitude.toFixed(5);
      const meter = Math.round(accuracy);
      currentLocation = {
        latitude: lat,
        longitude: lon,
        accuracy: meter,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem("lingyu_location", JSON.stringify(currentLocation));

      locationTitle.textContent = meter <= 80 ? "定位正常" : "定位精度较低";
      locationDetail.textContent = `纬度 ${lat}，经度 ${lon}，误差约 ${meter} 米。`;
      locateButton.disabled = false;
      locateButton.textContent = uiText.locate;
      systemState.textContent = "定位已更新";
      speak(meter <= 80 ? "我知道你大概在哪里了。只在你允许时使用。" : "定位有点飘，我先只做粗略判断。");
    },
    (error) => {
      const messages = {
        1: "你拒绝了定位授权，我不会继续请求。",
        2: "暂时无法获取位置，可能是信号或系统服务不可用。",
        3: "定位超时了，可以稍后再试一次。"
      };
      locationTitle.textContent = "定位失败";
      locationDetail.textContent = messages[error.code] || "定位服务返回了未知错误。";
      locateButton.disabled = false;
      locateButton.textContent = uiText.locate;
      systemState.textContent = "等待授权";
      speak("没关系，位置权限交给你决定。");
    },
    {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 1000 * 60
    }
  );
});

function sendMessage(text, source = "typed", options = {}) {
  const value = String(text || "").trim();
  if (!value) return;
  touchInteraction();
  const turnId = ++latestUserTurn;
  tone(360, 0.05, "triangle", 0.02);
  addBubble(value, "user");
  chatHistory.push({ role: "user", content: value });
  rememberFrom(value);
  saveState();
  input.value = "";
  systemState.textContent = "正在思考";
  subtitle.textContent = "我想一下。";
  isThinking = true;
  syncMotionState();
  askDoubao(value, { ...options, source, messages: chatHistory.slice(0, -1).slice(-6) })
    .then((reply) => {
      if (turnId !== latestUserTurn) return;
      if (isTooSimilarToRecentAi(reply)) {
        systemState.textContent = "换个说法";
        return askDoubao(value, {
          ...options,
          source,
          avoidRepeat: true,
          messages: chatHistory.slice(0, -1).slice(-8)
        }).then((freshReply) => {
          if (turnId !== latestUserTurn) return;
          systemState.textContent = "在线推理";
          speak(freshReply);
        });
      }
      systemState.textContent = "在线推理";
      speak(reply);
    })
    .catch(() => {
      if (turnId !== latestUserTurn) return;
      systemState.textContent = "离线回复";
      window.setTimeout(() => speak(localReply(value)), 260);
    })
    .finally(() => {
      if (turnId === latestUserTurn) {
        isThinking = false;
        syncMotionState();
        if (!voiceOutputActive) scheduleVoiceChatRestart(500);
      }
    });
}

function maybeStartAutonomousTalk() {
  window.setInterval(() => {
    const idleMs = Date.now() - lastInteractionAt;
    if (isThinking || backgroundThinking || idleMs < 75000 || document.hidden) return;
    const idleStartedAt = lastInteractionAt;
    backgroundThinking = true;
    syncMotionState();
    systemState.textContent = "主动想你";
    subtitle.textContent = "我自己想说一句。";
    askDoubao("你是屿。你突然想和屏幕对面的人说一句话，像平时一样说。", { source: "autonomous" })
      .then((reply) => {
        if (!isThinking && !document.hidden && lastInteractionAt === idleStartedAt && !isTooSimilarToRecentAi(reply)) speak(reply);
      })
      .catch(() => {
        if (!isThinking && !document.hidden && lastInteractionAt === idleStartedAt) speak("你安静太久了。我还在。");
      })
      .finally(() => {
        if (!isThinking) systemState.textContent = "在线";
        backgroundThinking = false;
        syncMotionState();
      });
  }, 30000);
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = setVoice;
  setVoice();
}

if (characterVideo) {
  characterVideo.play().catch(() => {});
}

function updateNetworkState() {
  offlineState.textContent = navigator.onLine ? "在线" : "离线可用";
}

function updateBuiltInState() {
  const eyes = cameraStream ? "\u773c\u775b\u5df2\u5f00" : "\u773c\u775b\u5f85\u6388\u6743";
  const ears = isListening ? "\u542c\u7740" : (microphoneStream ? "\u542c\u89c9\u5df2\u5f00" : "\u542c\u89c9\u5f85\u6388\u6743");
  const location = currentLocation ? "\u5b9a\u4f4d\u5df2\u5f00" : "\u5b9a\u4f4d\u5f85\u6388\u6743";
  systemState.textContent = `${eyes} / ${ears} / ${location}`;
  locationTitle.textContent = currentLocation ? "\u5b9a\u4f4d\u5728\u7ebf" : "\u7b49\u5f85\u4f4d\u7f6e\u6388\u6743";
  locationDetail.textContent = currentLocation
    ? `\u7eac\u5ea6 ${currentLocation.latitude}\uff0c\u7ecf\u5ea6 ${currentLocation.longitude}\uff0c\u8bef\u5dee\u7ea6 ${currentLocation.accuracy} \u7c73\u3002`
    : "\u8fdb\u5165\u540e\u4f1a\u4e3b\u52a8\u5f39\u51fa\u6743\u9650\u8bf7\u6c42\u3002";
}

function requestBuiltInLocation() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        currentLocation = {
          latitude: latitude.toFixed(5),
          longitude: longitude.toFixed(5),
          accuracy: Math.round(accuracy),
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem("lingyu_location", JSON.stringify(currentLocation));
        updateBuiltInState();
        resolve(true);
      },
      () => {
        updateBuiltInState();
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 1000 * 60 * 5 }
    );
  });
}

async function requestBuiltInCamera() {
  if (cameraStream || !navigator.mediaDevices?.getUserMedia) return Boolean(cameraStream);
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    cameraVideo = document.createElement("video");
    cameraVideo.muted = true;
    cameraVideo.playsInline = true;
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    eyeButton.textContent = uiText.eyeOn;
    eyeButton.classList.add("active");
    updateBuiltInState();
    return true;
  } catch {
    updateBuiltInState();
    return false;
  }
}

function startBuiltInRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => {
      isListening = true;
      syncListeningState();
      activeAudioCapture = startAudioCapture();
      subtitle.textContent = "我听着。";
      updateBuiltInState();
    };
    recognition.onresult = async (event) => {
      let text = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) text += result[0]?.transcript || "";
      }
      text = text.trim();
      if (!text) {
        const interim = Array.from(event.results)
          .map((result) => result[0]?.transcript || "")
          .join("")
          .trim();
        if (interim) subtitle.textContent = interim;
        return;
      }
      const audio = await stopActiveAudioCapture();
      if (text) sendMessage(text, "voice", audio || {});
      try {
        recognition.stop();
      } catch {}
    };
    recognition.onerror = () => {
      stopActiveAudioCapture();
      isListening = false;
      syncListeningState();
      updateBuiltInState();
    };
    recognition.onend = () => {
      stopActiveAudioCapture();
      isListening = false;
      syncListeningState();
      updateBuiltInState();
      scheduleVoiceChatRestart(700);
    };
  }
  try {
    if (isListening || isThinking || voiceOutputActive || document.hidden) return false;
    recognition.start();
    return true;
  } catch {
    return false;
  }
}

async function requestBuiltInVoice() {
  voiceChatEnabled = true;
  if (!navigator.mediaDevices?.getUserMedia) {
    startBuiltInRecognition();
    updateBuiltInState();
    return false;
  }
  try {
    if (!microphoneStream) {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    startBuiltInRecognition();
    subtitle.textContent = "你直接说，我听着。";
    updateBuiltInState();
    return true;
  } catch {
    startBuiltInRecognition();
    updateBuiltInState();
    return false;
  }
}

async function enableBuiltInCapabilities() {
  if (builtInBooting) return;
  if (builtInStarted && cameraStream && microphoneStream && currentLocation) return;
  builtInBooting = true;
  builtInStarted = true;
  if (!soundEnabled) enableSound();
  subtitle.textContent = "\u6211\u5728\u8981\u6743\u9650\u4e86\u3002";
  updateBuiltInState();
  await Promise.allSettled([
    requestBuiltInLocation(),
    requestBuiltInCamera(),
    requestBuiltInVoice()
  ]);
  builtInBooting = false;
  updateBuiltInState();
}

function startBuiltInOnce() {
  enableBuiltInCapabilities();
}

window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);
window.addEventListener("load", () => window.setTimeout(startBuiltInOnce, 500), { once: true });
document.addEventListener("pointerdown", startBuiltInOnce);
input.addEventListener("focus", startBuiltInOnce);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && builtInStarted) startBuiltInOnce();
});

initText();
updateNetworkState();
loadServerMemory();
maybeStartAutonomousTalk();
setClock();
setInterval(setClock, 1000 * 30);
addBubble(uiText.subtitle, "ai");
showSubtitleSequence(uiText.subtitle);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
