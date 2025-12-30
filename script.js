/* ========= Module: Utilities ========= */
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const uid = () => "r_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const nowISO = () => new Date().toISOString();
const safeText = (v) => (typeof v === "string" ? v : "");

const linesToArray = (text) =>
  safeText(text)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const formatDateTime = (iso) => {
  try { return new Date(iso).toLocaleString(); }
  catch { return iso || ""; }
};

const icon = (id) => {
  const tpl = qs(`#tpl-icon-${id}`);
  return tpl ? tpl.innerHTML : "";
};

const downloadTextFile = (filename, text) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const copyToClipboard = async (text) => { await navigator.clipboard.writeText(text); };

function escapeHtml(str) {
  return safeText(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const getByPath = (obj, path) => {
  const parts = safeText(path).split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
};

const setByPath = (obj, path, value) => {
  const parts = safeText(path).split(".").filter(Boolean);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
};

const isEmptyValue = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
};

const toast = (msg, kind = "info") => {
  const root = qs("#toastRoot") || (() => {
    const el = document.createElement("div");
    el.id = "toastRoot";
    el.className = "fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 space-y-2";
    document.body.appendChild(el);
    return el;
  })();

  const color =
    kind === "ok" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
    kind === "bad" ? "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" :
    "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";

  const item = document.createElement("div");
  item.className = `rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow-soft)] backdrop-blur ${color}`;
  item.textContent = msg;

  root.appendChild(item);
  setTimeout(() => { item.remove(); }, 2400);
};

/* ========= Module: Storage ========= */
const STORAGE_KEY = "newsletter_wizard_v2";

const defaultRoundData = () => ({
  topic: {
    direction: "",
    whoHelps: "",
    problemOneLiner: "",
    validationProof: "",
    checklist: { hasReferences: false, broadEnough: false, problemClear: false, whoClear: false }
  },
  title: {
    referenceTitles: "",
    format: "howto",
    powerWord: "dangerously",
    topicNoun: "",
    finalTitle: "",
    subtitle: ""
  },
  research: { sources: "", claims: "", gaps: "" },
  ideation: {
    prompts: { currentStruggle: "", pastSelf: "", everyoneWrong: "", metaphorSource: "" },
    insightsMain: "",
    insightsSupporting: "",
    metaphors: ""
  },
  outline: {
    problem: { enemy: "", consequences: "", mattersNow: "" },
    insight: { reframing: "", story: "", contrarian: "" },
    solution: { steps: "", startToday: "" },
    sections: [
      { title: "Section 1", what: "", how: "", why: "" },
      { title: "Section 2", what: "", how: "", why: "" }
    ]
  },
  draft: { focusMode: false, timerMinutes: 75, timerState: "idle", timerEndsAt: "", text: "" },
  edits: {
    activePass: "logic",
    finalDraft: "",
    passNotes: { logic: "", clarity: "", compression: "", essence: "" }
  },
  publish: {
    checklist: {
      titlePromisesBenefit: false,
      introStatesProblemFast: false,
      insightIsDifferent: false,
      stepsAreActionable: false,
      endingHasCTA: false,
      savedBestLines: false
    },
    swipeLines: "",
    callToAction: ""
  },
  ai: { lastNotes: "" }
});

const defaultAppState = () => ({
  version: 2,
  settings: {
    darkMode: false,
    ai: {
      endpoint: "",
      apiKey: "",
      model: "gpt-4.1-mini",
      provider: "custom",
      fillMode: "missing",
      allowLongDraft: false,
      timeoutMs: 45000
    }
  },
  rounds: [],
  activeRoundId: "",
  ui: { aiBusy: false }
});

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultAppState();
    return {
      ...defaultAppState(),
      ...parsed,
      settings: {
        ...defaultAppState().settings,
        ...(parsed.settings || {}),
        ai: { ...defaultAppState().settings.ai, ...((parsed.settings || {}).ai || {}) }
      },
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
      ui: { ...defaultAppState().ui, ...(parsed.ui || {}) }
    };
  } catch {
    return defaultAppState();
  }
};

let appState = loadState();

const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));

const createRound = () => {
  const id = uid();
  const createdAt = nowISO();
  return { id, createdAt, updatedAt: createdAt, currentStep: 0, data: defaultRoundData(), name: "" };
};

const getActiveRound = () => appState.rounds.find((r) => r.id === appState.activeRoundId) || null;

const ensureActiveRound = () => {
  if (!appState.rounds.length) {
    const r = createRound();
    appState.rounds.unshift(r);
    appState.activeRoundId = r.id;
    saveState();
    return r;
  }
  if (!appState.activeRoundId || !getActiveRound()) {
    appState.activeRoundId = appState.rounds[0].id;
    saveState();
  }
  return getActiveRound();
};

const setRoundUpdated = () => {
  const r = ensureActiveRound();
  r.updatedAt = nowISO();
};

const updateRoundData = (path, value) => {
  const r = ensureActiveRound();
  setByPath(r.data, path, value);
  if (!r.name) r.name = suggestRoundName(r.data);
  setRoundUpdated();
  saveState();
};

const suggestRoundName = (data) => {
  const t = safeText(data?.title?.finalTitle).trim();
  if (t) return t;
  const d = safeText(data?.topic?.direction).trim();
  const p = safeText(data?.topic?.problemOneLiner).trim();
  if (d) return d.length > 60 ? d.slice(0, 60) + "…" : d;
  if (p) return p.length > 60 ? p.slice(0, 60) + "…" : p;
  return "";
};

/* ========= Module: Steps ========= */
const steps = [
  { id: "topic", title: "Validated topic", blurb: "Pick a topic people already click, then angle it through your voice." },
  { id: "title", title: "Title builder", blurb: "Remix proven title patterns into your own." },
  { id: "research", title: "Research stash", blurb: "Prime your mind with diverse sources and capture claims + gaps." },
  { id: "ideation", title: "Essence + insights", blurb: "Mine your unique angle: reframing, metaphor, contrarian truth." },
  { id: "outline", title: "Outline", blurb: "Problem → Insight → Solution, with WHAT/HOW/WHY per section." },
  { id: "draft", title: "Draft sprint", blurb: "Write fast without editing. Build first, polish later." },
  { id: "edit", title: "Editing passes", blurb: "Tighten logic, clarity, compression, then re-inject essence." },
  { id: "publish", title: "Publish + export", blurb: "Checklist, swipe file, and exports you can ship today." }
];

const AI_FIELDS_BY_STEP = {
  topic: [
    "topic.direction",
    "topic.whoHelps",
    "topic.problemOneLiner",
    "topic.validationProof",
    "topic.checklist.hasReferences",
    "topic.checklist.broadEnough",
    "topic.checklist.problemClear",
    "topic.checklist.whoClear"
  ],
  title: [
    "title.referenceTitles",
    "title.format",
    "title.powerWord",
    "title.topicNoun",
    "title.finalTitle",
    "title.subtitle"
  ],
  research: ["research.sources", "research.claims", "research.gaps"],
  ideation: [
    "ideation.prompts.currentStruggle",
    "ideation.prompts.pastSelf",
    "ideation.prompts.everyoneWrong",
    "ideation.prompts.metaphorSource",
    "ideation.insightsMain",
    "ideation.insightsSupporting",
    "ideation.metaphors"
  ],
  outline: ["outline.problem", "outline.insight", "outline.solution", "outline.sections"],
  draft: ["draft.text"],
  edit: ["edits.finalDraft", "edits.passNotes.logic", "edits.passNotes.clarity", "edits.passNotes.compression", "edits.passNotes.essence"],
  publish: ["publish.callToAction", "publish.swipeLines", "publish.checklist"]
};

/* ========= Module: UI Helpers ========= */
const sectionHeader = (title, subtitle = "") => `
  <div class="mb-4">
    <div class="text-base font-semibold">${escapeHtml(title)}</div>
    ${subtitle ? `<div class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">${escapeHtml(subtitle)}</div>` : ""}
  </div>
`;

const field = (label, hint, inputHtml) => `
  <label class="block">
    <div class="flex items-end justify-between gap-3">
      <div class="text-sm font-medium">${escapeHtml(label)}</div>
      ${hint ? `<div class="text-xs text-zinc-600 dark:text-zinc-400">${escapeHtml(hint)}</div>` : ""}
    </div>
    <div class="mt-2">${inputHtml}</div>
  </label>
`;

const inputText = (path, value, placeholder = "") => `
  <input
    class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 placeholder:text-zinc-400 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
    data-path="${escapeHtml(path)}"
    value="${escapeHtml(value)}"
    placeholder="${escapeHtml(placeholder)}"
  />
`;

const inputNumber = (path, value, min, max) => `
  <input
    type="number"
    min="${min}"
    max="${max}"
    class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950"
    data-path="${escapeHtml(path)}"
    data-kind="number"
    value="${Number.isFinite(value) ? value : min}"
  />
`;

const textarea = (path, value, placeholder = "", rows = 6) => `
  <textarea
    class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 placeholder:text-zinc-400 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
    data-path="${escapeHtml(path)}"
    rows="${rows}"
    placeholder="${escapeHtml(placeholder)}"
  >${escapeHtml(value)}</textarea>
`;

const checkbox = (path, checked) => `
  <input
    type="checkbox"
    class="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700"
    data-path="${escapeHtml(path)}"
    data-kind="checkbox"
    ${checked ? "checked" : ""}
  />
`;

/* ========= Module: AI Client ========= */
const withTimeout = async (promise, ms) => {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("Request timed out")), ms); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(t); }
};

const AI_PROVIDERS = [
  { id: "custom", label: "Custom JSON" },
  { id: "openai", label: "OpenAI-compatible" },
  { id: "anthropic", label: "Anthropic-compatible" }
];

const normalizeAiProvider = (value) => {
  if (value === "openai") return "openai";
  if (value === "anthropic") return "anthropic";
  return "custom";
};

const buildAiRequest = (stepId, roundData, allowedFields, settings = appState.settings.ai) => {
  const s = settings;
  const title = safeText(roundData?.title?.finalTitle).trim();
  const direction = safeText(roundData?.topic?.direction).trim();
  const problem = safeText(roundData?.topic?.problemOneLiner).trim();
  const fillMode = s.fillMode;

  const system = [
    "You are an assistant that fills structured newsletter-planning fields.",
    "Return ONLY JSON.",
    "Shape: {\"updates\": {<path>: <value>}, \"notes\": \"...\"}.",
    "Paths must be from allowed_fields only.",
    "If fill_mode is \"missing\", only propose values for fields that are empty or clearly incomplete.",
    "Keep answers concise and usable.",
    "For outline.sections, return an array of section objects: {title, what, how, why}.",
    "Do not include markdown fences."
  ].join(" ");

  const context = {
    step_id: stepId,
    fill_mode: fillMode,
    allow_long_draft: !!s.allowLongDraft,
    round_hint: { title, direction, problem },
    allowed_fields: allowedFields,
    current_round_data: roundData
  };

  return { system, context, provider: normalizeAiProvider(s.provider) };
};

const buildAiHeaders = (provider, apiKey) => {
  const headers = { "Content-Type": "application/json" };
  const key = safeText(apiKey).trim();
  if (!key) return headers;
  if (provider === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${key}`;
  }
  return headers;
};

const buildAiPayload = (req, settings = appState.settings.ai) => {
  const model = safeText(settings.model).trim() || undefined;
  const contextJson = JSON.stringify(req.context);

  if (req.provider === "openai") {
    return {
      model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: contextJson }
      ]
    };
  }

  if (req.provider === "anthropic") {
    return {
      model,
      system: req.system,
      messages: [{ role: "user", content: contextJson }],
      max_tokens: 1024
    };
  }

  return { system: req.system, input: req.context, model };
};

const extractOpenAiContent = (payload) =>
  safeText(payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || "");

const extractAnthropicContent = (payload) => {
  if (Array.isArray(payload?.content)) {
    return payload.content.map((part) => safeText(part?.text)).join("");
  }
  return safeText(payload?.completion || payload?.message?.content || "");
};

const validateAiUpdates = (updates, allowedFields) => {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new Error("AI response missing updates object");
  }

  const allowed = new Set(allowedFields || []);
  const sanitized = {};

  for (const [path, value] of Object.entries(updates)) {
    if (typeof path !== "string") continue;
    if (
      allowed.has(path) ||
      path === "outline.sections" ||
      path === "outline.problem" ||
      path === "outline.insight" ||
      path === "outline.solution" ||
      path === "publish.checklist" ||
      path.startsWith("topic.checklist.")
    ) {
      sanitized[path] = value;
    }
  }

  return sanitized;
};

const parseAiResponse = (provider, rawText, allowedFields) => {
  let payload;
  try { payload = JSON.parse(rawText); }
  catch { throw new Error("AI response was not valid JSON"); }

  const normalizeParsed = (parsed) => {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("AI response was not an object");
    }
    const notes = safeText(parsed.notes);
    const updates = validateAiUpdates(parsed.updates, allowedFields);
    return { updates, notes };
  };

  if (provider === "custom") return normalizeParsed(payload);

  const content =
    provider === "openai"
      ? extractOpenAiContent(payload)
      : extractAnthropicContent(payload);

  if (!safeText(content).trim()) {
    throw new Error("AI response missing message content");
  }

  let parsedContent;
  try { parsedContent = JSON.parse(content); }
  catch { throw new Error("AI response message was not valid JSON"); }

  return normalizeParsed(parsedContent);
};

const aiAutofillCurrentStep = async () => {
  const r = ensureActiveRound();
  const stepId = steps[r.currentStep].id;
  const allowed = AI_FIELDS_BY_STEP[stepId] || [];

  const s = appState.settings.ai;
  if (!safeText(s.endpoint).trim()) {
    openAiSettingsModal();
    toast("Set your AI endpoint first.", "bad");
    return;
  }

  if (stepId === "draft" && !s.allowLongDraft) {
    toast("Enable ‘Allow long draft’ in AI settings if you want AI to write the draft.", "bad");
    return;
  }

  if (appState.ui.aiBusy) return;
  appState.ui.aiBusy = true;
  saveState();
  syncAiButtons();

  try {
    const req = buildAiRequest(stepId, r.data, allowed);
    const headers = buildAiHeaders(req.provider, s.apiKey);
    const payload = buildAiPayload(req);

    const resp = await withTimeout(
      fetch(s.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      }),
      clamp(Number(s.timeoutMs) || 45000, 5000, 180000)
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`AI endpoint error (${resp.status}): ${text.slice(0, 200)}`);
    }

    const raw = await resp.text();
    const parsed = parseAiResponse(req.provider, raw, allowed);

    applyAiUpdates(stepId, parsed.updates);
    r.data.ai.lastNotes = parsed.notes || "";
    r.name = suggestRoundName(r.data) || r.name;

    setRoundUpdated();
    saveState();
    renderAppShell();
    toast("AI filled this step.", "ok");
  } catch (e) {
    toast(e?.message || "AI fill failed", "bad");
  } finally {
    appState.ui.aiBusy = false;
    saveState();
    syncAiButtons();
  }
};

const applyAiUpdates = (stepId, updates) => {
  const r = ensureActiveRound();
  const allowed = new Set(AI_FIELDS_BY_STEP[stepId] || []);
  const fillMode = appState.settings.ai.fillMode;

  for (const [path, value] of Object.entries(updates)) {
    if (!allowed.has(path) && path !== "outline.sections" && path !== "outline.problem" && path !== "outline.insight" && path !== "outline.solution" && path !== "publish.checklist") continue;

    const current = getByPath(r.data, path);
    if (fillMode === "missing") {
      if (!isEmptyValue(current)) continue;
      if (typeof current === "boolean") continue;
    }

    if (path === "publish.checklist" && typeof value === "object" && value) {
      const keys = Object.keys(r.data.publish.checklist || {});
      const next = { ...(r.data.publish.checklist || {}) };
      for (const k of keys) if (k in value) next[k] = !!value[k];
      setByPath(r.data, path, next);
      continue;
    }

    if (path.startsWith("topic.checklist.") && typeof value !== "boolean") {
      setByPath(r.data, path, !!value);
      continue;
    }

    if (path === "outline.sections" && Array.isArray(value)) {
      const cleaned = value
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          title: safeText(x.title).trim() || "Section",
          what: safeText(x.what),
          how: safeText(x.how),
          why: safeText(x.why)
        }))
        .slice(0, 10);
      if (fillMode === "missing" && Array.isArray(r.data.outline.sections) && r.data.outline.sections.length) {
        continue;
      }
      r.data.outline.sections = cleaned.length ? cleaned : r.data.outline.sections;
      continue;
    }

    if (path === "outline.problem" && value && typeof value === "object") {
      const next = { ...(r.data.outline.problem || {}) };
      if ("enemy" in value) next.enemy = safeText(value.enemy);
      if ("consequences" in value) next.consequences = safeText(value.consequences);
      if ("mattersNow" in value) next.mattersNow = safeText(value.mattersNow);
      if (fillMode === "missing" && !isEmptyValue(r.data.outline.problem?.enemy)) continue;
      r.data.outline.problem = next;
      continue;
    }

    if (path === "outline.insight" && value && typeof value === "object") {
      const next = { ...(r.data.outline.insight || {}) };
      if ("reframing" in value) next.reframing = safeText(value.reframing);
      if ("story" in value) next.story = safeText(value.story);
      if ("contrarian" in value) next.contrarian = safeText(value.contrarian);
      if (fillMode === "missing" && !isEmptyValue(r.data.outline.insight?.reframing)) continue;
      r.data.outline.insight = next;
      continue;
    }

    if (path === "outline.solution" && value && typeof value === "object") {
      const next = { ...(r.data.outline.solution || {}) };
      if ("steps" in value) next.steps = safeText(value.steps);
      if ("startToday" in value) next.startToday = safeText(value.startToday);
      if (fillMode === "missing" && !isEmptyValue(r.data.outline.solution?.steps)) continue;
      r.data.outline.solution = next;
      continue;
    }

    if (typeof value === "string") setByPath(r.data, path, value);
    else if (typeof value === "number") setByPath(r.data, path, value);
    else if (typeof value === "boolean") setByPath(r.data, path, value);
    else if (value && typeof value === "object") setByPath(r.data, path, value);
  }
};

/* ========= Module: Step Views (same guided UI, with AI notes box) ========= */
const titleFormats = [
  { id: "howto", label: "How to…" },
  { id: "stop", label: "Stop…" },
  { id: "truth", label: "The uncomfortable truth…" },
  { id: "myth", label: "The myth of…" },
  { id: "why", label: "Why you…" }
];

const powerWords = ["dangerously", "quietly", "brutally", "effortlessly", "consistently", "quickly", "finally", "deeply"];

const buildTitleSuggestions = (data) => {
  const refs = linesToArray(data.title.referenceTitles);
  const noun = safeText(data.title.topicNoun).trim() || "this";
  const pw = safeText(data.title.powerWord).trim() || "dangerously";
  const fmt = safeText(data.title.format).trim() || "howto";

  const seeds = refs.slice(0, 8).map((t) => t.replace(/\s+/g, " ").trim());
  const base = seeds.length
    ? seeds
    : [
        `How to become ${pw} good at ${noun}`,
        `Stop doing this if you want ${noun}`,
        `The myth of ${noun}`,
        `Why you struggle with ${noun}`,
        `The uncomfortable truth about ${noun}`
      ];

  const variants = [];
  const push = (t) => {
    const x = t.trim();
    if (!x) return;
    if (!variants.includes(x)) variants.push(x);
  };

  base.forEach((t) => push(t));

  if (fmt === "howto") {
    push(`How to become ${pw} better at ${noun}`);
    push(`How to master ${noun} without overthinking`);
    push(`How to get good at ${noun} (without grinding your life away)`);
  }
  if (fmt === "stop") {
    push(`Stop doing this if you want ${noun}`);
    push(`Stop trying to ${noun} like everyone else`);
    push(`Stop consuming. Start thinking: the ${noun} fix`);
  }
  if (fmt === "truth") {
    push(`The uncomfortable truth about ${noun}`);
    push(`The harsh truth: you don’t need motivation for ${noun}`);
    push(`The real reason ${noun} feels impossible`);
  }
  if (fmt === "myth") {
    push(`The myth of ${noun}`);
    push(`The myth that’s keeping you bad at ${noun}`);
    push(`The ancient mistake everyone makes about ${noun}`);
  }
  if (fmt === "why") {
    push(`Why you can’t ${noun} (and what to do instead)`);
    push(`Why your ${noun} isn’t improving`);
    push(`Why you keep failing at ${noun}`);
  }

  push(`Useful writing is necessary. Essence is leverage: ${noun}`);
  push(`Constraint primes creativity: the ${noun} method`);
  push(`Solve the problem first, then add your soul: ${noun}`);

  return variants.slice(0, 12);
};

const wordCount = (text) => {
  const t = safeText(text).replace(/\s+/g, " ").trim();
  if (!t) return 0;
  return t.split(" ").filter(Boolean).length;
};

let timerTick = null;

const stopTimerTick = () => {
  if (timerTick) { clearInterval(timerTick); timerTick = null; }
};

const startTimerTick = () => {
  stopTimerTick();
  timerTick = setInterval(() => {
    const r = ensureActiveRound();
    if (steps[r.currentStep].id !== "draft") return;

    const statusEl = qs("#timerStatus");
    const countdownEl = qs("#timerCountdown");

    const state = safeText(r.data.draft.timerState) || "idle";
    if (statusEl) statusEl.textContent = state;

    if (state !== "running") {
      if (countdownEl) countdownEl.textContent = "";
      return;
    }

    const endsAt = safeText(r.data.draft.timerEndsAt);
    const ms = endsAt ? new Date(endsAt).getTime() - Date.now() : 0;

    if (ms <= 0) {
      r.data.draft.timerState = "done";
      r.data.draft.timerEndsAt = "";
      setRoundUpdated();
      saveState();
      if (statusEl) statusEl.textContent = "done";
      if (countdownEl) countdownEl.textContent = "— time";
      return;
    }

    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (countdownEl) countdownEl.textContent = `— ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, 250);
};

const startTimer = () => {
  const r = ensureActiveRound();
  const mins = clamp(Number(r.data.draft.timerMinutes) || 75, 1, 999);
  r.data.draft.timerEndsAt = new Date(Date.now() + mins * 60 * 1000).toISOString();
  r.data.draft.timerState = "running";
  setRoundUpdated();
  saveState();
  startTimerTick();
};

const pauseTimer = () => {
  const r = ensureActiveRound();
  if (r.data.draft.timerState !== "running") return;

  const endsAt = safeText(r.data.draft.timerEndsAt);
  const remainingMs = endsAt ? new Date(endsAt).getTime() - Date.now() : 0;
  const remainingMins = Math.max(0, Math.ceil(remainingMs / 60000));

  r.data.draft.timerMinutes = remainingMins;
  r.data.draft.timerEndsAt = "";
  r.data.draft.timerState = "paused";
  setRoundUpdated();
  saveState();
  renderStepContent();
};

const resetTimer = () => {
  const r = ensureActiveRound();
  r.data.draft.timerEndsAt = "";
  r.data.draft.timerState = "idle";
  setRoundUpdated();
  saveState();
  renderStepContent();
};

const aiNotesBox = (data) => {
  const notes = safeText(data.ai?.lastNotes).trim();
  if (!notes) return "";
  return `
    <div class="mt-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3 text-sm text-indigo-800 dark:text-indigo-200">
      <div class="font-semibold">AI notes</div>
      <div class="mt-1 text-indigo-700/80 dark:text-indigo-200/80">${escapeHtml(notes)}</div>
    </div>
  `;
};

/* ========= Module: Render Step Content ========= */
const renderTopicStep = (data) => {
  const proofLines = linesToArray(data.topic.validationProof);
  const checklist = data.topic.checklist || {};
  const autoHasReferences = proofLines.length >= 5;
  const autoProblemClear = safeText(data.topic.problemOneLiner).trim().length >= 12;
  const autoWhoClear = safeText(data.topic.whoHelps).trim().length >= 6;

  const score =
    (checklist.hasReferences || autoHasReferences ? 1 : 0) +
    (checklist.broadEnough ? 1 : 0) +
    (checklist.problemClear || autoProblemClear ? 1 : 0) +
    (checklist.whoClear || autoWhoClear ? 1 : 0);

  const scoreLabel = score >= 4 ? "Validated" : score === 3 ? "Close" : score === 2 ? "Unclear" : "Not validated";
  const scoreColor = score >= 4 ? "bg-emerald-500" : score === 3 ? "bg-amber-500" : "bg-rose-500";

  return `
    ${sectionHeader("Pick a validated topic", "The topic earns the click. Your perspective earns the share.")}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        ${field("What do you feel like writing under?", "Broad direction", inputText("topic.direction", data.topic.direction, "e.g., articulation, reading, self-education"))}
        <div class="mt-4">${field("Who does this help?", "One sentence", inputText("topic.whoHelps", data.topic.whoHelps, "e.g., people who freeze in conversations and want to speak clearly"))}</div>
        <div class="mt-4">${field("Reader problem (one-liner)", "Make it concrete", inputText("topic.problemOneLiner", data.topic.problemOneLiner, "e.g., I ramble because I don’t think in structured points"))}</div>
        <div class="mt-4">${field("Proof of demand (titles/links)", "One per line", textarea("topic.validationProof", data.topic.validationProof, "Paste 5–10 strong titles/links that prove demand.", 8))}</div>
        ${aiNotesBox(data)}
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">Validation meter</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Aim for 4/4 before you commit.</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full ${scoreColor}"></span>
            <span class="text-sm font-semibold">${scoreLabel}</span>
            <span class="text-xs text-zinc-600 dark:text-zinc-400">(${score}/4)</span>
          </div>
        </div>

        <div class="mt-4 space-y-3">
          <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div class="text-sm">I collected 5+ reference titles/links</div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">${proofLines.length} lines</span>
              ${checkbox("topic.checklist.hasReferences", !!checklist.hasReferences)}
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div class="text-sm">The topic is broad (not only about me)</div>
            ${checkbox("topic.checklist.broadEnough", !!checklist.broadEnough)}
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div class="text-sm">I can state the reader problem in one sentence</div>
            ${checkbox("topic.checklist.problemClear", !!checklist.problemClear)}
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div class="text-sm">I can name who this helps</div>
            ${checkbox("topic.checklist.whoClear", !!checklist.whoClear)}
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          <div class="font-semibold">Quick rule</div>
          <div class="mt-1 text-zinc-600 dark:text-zinc-400">If you can’t prove demand, broaden the title until strangers would click it.</div>
        </div>
      </div>
    </div>
  `;
};

const renderTitleStep = (data) => {
  const suggestions = buildTitleSuggestions(data);

  return `
    ${sectionHeader("Build a title that earns the click", "Use proven patterns, then inject your taste.")}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        ${field("Reference titles (paste)", "One per line", textarea("title.referenceTitles", data.title.referenceTitles, "Paste 5–20 titles you found that perform well.", 8))}
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="block">
            <div class="text-sm font-medium">Format</div>
            <select data-path="title.format" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950">
              ${titleFormats.map((f) => `<option value="${f.id}" ${data.title.format === f.id ? "selected" : ""}>${f.label}</option>`).join("")}
            </select>
          </label>
          <label class="block">
            <div class="text-sm font-medium">Power word</div>
            <select data-path="title.powerWord" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950">
              ${powerWords.map((w) => `<option value="${w}" ${data.title.powerWord === w ? "selected" : ""}>${w}</option>`).join("")}
            </select>
          </label>
        </div>

        <div class="mt-4">${field("Topic noun/phrase", "What the title is about", inputText("title.topicNoun", data.title.topicNoun, "e.g., articulation, thinking clearly, writing better"))}</div>
        <div class="mt-4 grid gap-3">
          ${field("Final title", "This becomes the round name", inputText("title.finalTitle", data.title.finalTitle, "Pick one suggestion or write your own"))}
          ${field("Subtitle (optional)", "One line promise", inputText("title.subtitle", data.title.subtitle, "e.g., A practical system for turning ideas into sharp writing"))}
        </div>
        ${aiNotesBox(data)}
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">Title suggestions</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Click one to set your final title.</div>
          </div>
          <button id="btnApplyTitleToRound" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
            ${icon("check")}
            Use as round name
          </button>
        </div>

        <div class="mt-4 space-y-2">
          ${suggestions
            .map(
              (t) => `
                <button type="button" class="titleSuggestion w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800/60" data-title="${escapeHtml(t)}">
                  <div class="font-semibold">${escapeHtml(t)}</div>
                </button>
              `
            )
            .join("")}
        </div>

        <div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          <div class="font-semibold">Quality bar</div>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
            <li>Promises a benefit</li>
            <li>Broad enough for strangers</li>
            <li>Specific enough to be believable</li>
            <li>Matches what the piece actually delivers</li>
          </ul>
        </div>
      </div>
    </div>
  `;
};

const renderResearchStep = (data) => `
  ${sectionHeader("Research stash", "Prime your brain, capture claims, then hunt the gap you can own.")}
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      ${field("Sources (paste)", "Links + notes, one per line", textarea("research.sources", data.research.sources, "Example:\n- https://… (what it argues)\n- Book: … (useful quote)\n- Essay: … (interesting contradiction)", 10))}
      ${aiNotesBox(data)}
    </div>

    <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      ${field("Key claims (what everyone repeats)", "Bullets are fine", textarea("research.claims", data.research.claims, "What do most creators say?\n- Claim 1\n- Claim 2\n- Claim 3", 7))}
      <div class="mt-4">${field("Gaps + angles (what’s missing?)", "This becomes your edge", textarea("research.gaps", data.research.gaps, "Where do you disagree?\nWhat feels oversimplified?\nWhat metaphor/story can you add?", 7))}</div>
      <div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        <div class="font-semibold">Target outcome</div>
        <div class="mt-1 text-zinc-600 dark:text-zinc-400">Leave with one sentence: “Most people say X, but they ignore Y — here’s the better frame.”</div>
      </div>
    </div>
  </div>
`;

const renderIdeationStep = (data) => `
  ${sectionHeader("Essence + insights", "Solve a validated problem, then offer a distinct lens worth sharing.")}
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div class="text-sm font-semibold">Prompt your thinking</div>
      <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Answer honestly. This is where your voice comes from.</div>
      <div class="mt-4 space-y-4">
        ${field("Your current struggle", "", textarea("ideation.prompts.currentStruggle", data.ideation.prompts.currentStruggle, "What are you trying to fix right now?", 4))}
        ${field("What your past self needed", "", textarea("ideation.prompts.pastSelf", data.ideation.prompts.pastSelf, "What would have saved you pain 6 months ago?", 4))}
        ${field("What everyone gets wrong", "", textarea("ideation.prompts.everyoneWrong", data.ideation.prompts.everyoneWrong, "What popular advice is incomplete or wrong?", 4))}
        ${field("Metaphor source", "Book, story, scene, experience", textarea("ideation.prompts.metaphorSource", data.ideation.prompts.metaphorSource, "What can you connect this to that feels fresh?", 4))}
      </div>
      ${aiNotesBox(data)}
    </div>

    <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      ${field("Main insight (one sentence)", "The reframing that makes something click", textarea("ideation.insightsMain", data.ideation.insightsMain, "Example:\nUseful writing is necessary, but essence is leverage.", 4))}
      <div class="mt-4">${field("Supporting insights (2–5)", "One per line", textarea("ideation.insightsSupporting", data.ideation.insightsSupporting, "Constraint primes creativity.\nOutlines prevent paralysis.\nTaste is the differentiator.", 6))}</div>
      <div class="mt-4">${field("Metaphors / stories to use", "One per line", textarea("ideation.metaphors", data.ideation.metaphors, "Sisyphus → struggle as progress.\nTraining → reps beat motivation.", 6))}</div>
      <div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        <div class="font-semibold">Quality check</div>
        <div class="mt-1 text-zinc-600 dark:text-zinc-400">If your insight sounds like generic advice, it’s not yours yet.</div>
      </div>
    </div>
  </div>
`;

const renderOutlineStep = (data) => {
  const sections = Array.isArray(data.outline.sections) ? data.outline.sections : [];
  return `
    ${sectionHeader("Outline (non-negotiable)", "Problem → Insight → Solution, then WHAT/HOW/WHY per section.")}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div class="text-sm font-semibold">Problem</div>
        <div class="mt-3 space-y-3">
          ${field("Enemy (what are we attacking?)", "", textarea("outline.problem.enemy", data.outline.problem.enemy, "Name the enemy clearly.", 3))}
          ${field("Consequences (if they don’t change)", "", textarea("outline.problem.consequences", data.outline.problem.consequences, "Paint the cost.", 3))}
          ${field("Why it matters now", "", textarea("outline.problem.mattersNow", data.outline.problem.mattersNow, "Make it urgent and relatable.", 3))}
        </div>

        <div class="mt-6 text-sm font-semibold">Insight</div>
        <div class="mt-3 space-y-3">
          ${field("Reframing sentence", "", textarea("outline.insight.reframing", data.outline.insight.reframing, "Your main insight in plain English.", 3))}
          ${field("Story / metaphor", "", textarea("outline.insight.story", data.outline.insight.story, "What image makes it memorable?", 3))}
          ${field("Contrarian angle", "", textarea("outline.insight.contrarian", data.outline.insight.contrarian, "What do most people miss?", 3))}
        </div>

        <div class="mt-6 text-sm font-semibold">Solution</div>
        <div class="mt-3 space-y-3">
          ${field("Steps (bullets)", "", textarea("outline.solution.steps", data.outline.solution.steps, "Step 1…\nStep 2…\nStep 3…", 5))}
          ${field("Start today (smallest action)", "", textarea("outline.solution.startToday", data.outline.solution.startToday, "What can they do in 10 minutes?", 3))}
        </div>
        ${aiNotesBox(data)}
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">Sections (WHAT / HOW / WHY)</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Add sections until the outline tells the whole story.</div>
          </div>
          <button id="btnAddSection" class="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" type="button">
            ${icon("plus")} Add section
          </button>
        </div>

        <div class="mt-4 space-y-4">
          ${sections
            .map((s, i) => {
              const titlePath = `outline.sections.${i}.title`;
              const whatPath = `outline.sections.${i}.what`;
              const howPath = `outline.sections.${i}.how`;
              const whyPath = `outline.sections.${i}.why`;
              return `
                <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-sm font-semibold">Section ${i + 1}</div>
                    <button type="button" class="btnRemoveSection inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" data-index="${i}">
                      Remove
                    </button>
                  </div>

                  <div class="mt-3">${field("Section title", "", inputText(titlePath, s.title || "", "e.g., The real reason you ramble"))}</div>
                  <div class="mt-3 grid gap-3">
                    ${field("WHAT", "2–3 bullets: pain, truth, curiosity", textarea(whatPath, s.what || "", "What points will you make?", 4))}
                    ${field("HOW", "explain, example, metaphor, steps", textarea(howPath, s.how || "", "How does it work?", 4))}
                    ${field("WHY", "tie back to big promise", textarea(whyPath, s.why || "", "Why does it matter?", 4))}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="mt-4 rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          <div class="font-semibold">Rule</div>
          <div class="mt-1 text-zinc-600 dark:text-zinc-400">If you can outline cleanly, drafting becomes explaining — not inventing.</div>
        </div>
      </div>
    </div>
  `;
};

const renderDraftStep = (data) => {
  const w = wordCount(data.draft.text);
  const timerState = safeText(data.draft.timerState);
  const minutes = Number.isFinite(data.draft.timerMinutes) ? data.draft.timerMinutes : 75;

  return `
    ${sectionHeader("Draft sprint", "Write fast. Don’t edit. Use the outline as rails.")}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">Sprint controls</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Aim for 60–90 minutes. One pass. No polishing.</div>
          </div>
          <span class="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">${w} words</span>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          ${field("Timer minutes", "60–90 typical", inputNumber("draft.timerMinutes", minutes, 15, 180))}
          <label class="block">
            <div class="text-sm font-medium">Mode</div>
            <div class="mt-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
              <div class="text-sm text-zinc-700 dark:text-zinc-200">Focus mode</div>
              ${checkbox("draft.focusMode", !!data.draft.focusMode)}
            </div>
          </label>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button id="btnTimerStart" class="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" type="button">Start</button>
          <button id="btnTimerPause" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">Pause</button>
          <button id="btnTimerReset" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">Reset</button>

          <div class="ml-auto flex items-center gap-2">
            <span class="text-xs text-zinc-600 dark:text-zinc-400">Status:</span>
            <span id="timerStatus" class="text-xs font-semibold">${escapeHtml(timerState || "idle")}</span>
            <span id="timerCountdown" class="text-xs text-zinc-600 dark:text-zinc-400"></span>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          <div class="font-semibold">No-edit rule</div>
          <div class="mt-1 text-zinc-600 dark:text-zinc-400">If you get stuck, add a bullet to the outline — don’t start polishing prose.</div>
        </div>
        ${aiNotesBox(data)}
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        ${field("Draft text", "Write straight through", textarea("draft.text", data.draft.text, "Start with the problem. Move to insight. End with steps + CTA.", 18))}
      </div>
    </div>
  `;
};

const editPasses = [
  { id: "logic", label: "Logic", prompt: "Does each section deliver WHAT/HOW/WHY and move the reader forward?" },
  { id: "clarity", label: "Clarity", prompt: "Replace vague lines with concrete examples and plain language." },
  { id: "compression", label: "Compression", prompt: "Cut repetition. Shorten sentences. Remove filler." },
  { id: "essence", label: "Essence", prompt: "Re-inject voice: metaphor, taste, a sharper point of view." }
];

const renderEditStep = (data) => {
  const active = safeText(data.edits.activePass) || "logic";
  const pass = editPasses.find((p) => p.id === active) || editPasses[0];

  return `
    ${sectionHeader("Editing passes", "Do it in order: logic → clarity → compression → essence.")}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">Pass selector</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">One pass at a time. Don’t multitask edits.</div>
          </div>
          <button id="btnSeedFinalFromDraft" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
            ${icon("check")} Use draft as base
          </button>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          ${editPasses
            .map(
              (p) => `
                <button type="button" class="passBtn rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${
                  p.id === active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                }" data-pass="${p.id}">
                  ${escapeHtml(p.label)}
                </button>
              `
            )
            .join("")}
        </div>

        <div class="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div class="text-sm font-semibold">${escapeHtml(pass.label)} prompt</div>
          <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">${escapeHtml(pass.prompt)}</div>
          <div class="mt-4">${field("Pass notes", "What you changed + why", textarea(`edits.passNotes.${pass.id}`, data.edits.passNotes?.[pass.id] || "", "Capture what you’re improving in this pass.", 6))}</div>
        </div>
        ${aiNotesBox(data)}
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        ${field("Final draft (living document)", "This is what you publish", textarea("edits.finalDraft", data.edits.finalDraft, "Paste or write your final version here. You can export it next.", 18))}
      </div>
    </div>
  `;
};

const checkRow = (path, checked, label) => `
  <div class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
    <div class="text-sm text-zinc-700 dark:text-zinc-200">${escapeHtml(label)}</div>
    ${checkbox(path, !!checked)}
  </div>
`;

const buildMarkdown = (data) => {
  const title = safeText(data.title.finalTitle).trim() || "Untitled";
  const subtitle = safeText(data.title.subtitle).trim();
  const cta = safeText(data.publish.callToAction).trim();
  const outlineSections = Array.isArray(data.outline.sections) ? data.outline.sections : [];
  const finalDraft = safeText(data.edits.finalDraft).trim() || safeText(data.draft.text).trim();

  const md = [];
  md.push(`# ${title}`);
  if (subtitle) md.push(`\n_${subtitle}_\n`);

  md.push(`\n## Outline\n`);
  md.push(`### Problem\n`);
  md.push(`- Enemy: ${safeText(data.outline.problem.enemy).trim()}`);
  md.push(`- Consequences: ${safeText(data.outline.problem.consequences).trim()}`);
  md.push(`- Why now: ${safeText(data.outline.problem.mattersNow).trim()}`);

  md.push(`\n### Insight\n`);
  md.push(`- Reframing: ${safeText(data.outline.insight.reframing).trim()}`);
  md.push(`- Story/metaphor: ${safeText(data.outline.insight.story).trim()}`);
  md.push(`- Contrarian angle: ${safeText(data.outline.insight.contrarian).trim()}`);

  md.push(`\n### Solution\n`);
  md.push(`${safeText(data.outline.solution.steps).trim() ? safeText(data.outline.solution.steps).trim() : "- (add steps)"}`);
  if (safeText(data.outline.solution.startToday).trim()) md.push(`\nStart today: ${safeText(data.outline.solution.startToday).trim()}`);

  md.push(`\n### Sections (WHAT / HOW / WHY)\n`);
  outlineSections.forEach((s, i) => {
    md.push(`\n#### ${i + 1}. ${safeText(s.title).trim() || `Section ${i + 1}`}`);
    md.push(`- WHAT: ${safeText(s.what).trim()}`);
    md.push(`- HOW: ${safeText(s.how).trim()}`);
    md.push(`- WHY: ${safeText(s.why).trim()}`);
  });

  md.push(`\n## Final Draft\n`);
  md.push(finalDraft ? `\n${finalDraft}\n` : `\n_(No final draft yet)_\n`);

  if (cta) {
    md.push(`\n## Call to Action\n`);
    md.push(`\n${cta}\n`);
  }

  const swipe = linesToArray(data.publish.swipeLines);
  if (swipe.length) {
    md.push(`\n## Swipe Lines\n`);
    swipe.forEach((l) => md.push(`- ${l}`));
  }

  return md.join("\n");
};

const renderPublishStep = (data) => {
  const c = data.publish.checklist || {};
  const swipeCount = linesToArray(data.publish.swipeLines).length;
  const finalTitle = safeText(data.title.finalTitle).trim() || "Untitled";

  return `
    ${sectionHeader("Publish + export", "Checklist, swipe file, and exports you can ship today.")}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">Publish checklist</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Your minimum bar before you ship.</div>
          </div>
          <span class="text-xs text-zinc-600 dark:text-zinc-400">${escapeHtml(finalTitle)}</span>
        </div>

        <div class="mt-4 space-y-3">
          ${checkRow("publish.checklist.titlePromisesBenefit", c.titlePromisesBenefit, "Title promises a clear benefit")}
          ${checkRow("publish.checklist.introStatesProblemFast", c.introStatesProblemFast, "Intro states the problem fast")}
          ${checkRow("publish.checklist.insightIsDifferent", c.insightIsDifferent, "Insight feels distinct (not generic)")}
          ${checkRow("publish.checklist.stepsAreActionable", c.stepsAreActionable, "Steps are actionable")}
          ${checkRow("publish.checklist.endingHasCTA", c.endingHasCTA, "Ending has a clear call-to-action")}
          ${checkRow("publish.checklist.savedBestLines", c.savedBestLines, "Saved best lines to swipe file")}
        </div>

        <div class="mt-4">${field("Call-to-action (optional)", "What should the reader do next?", textarea("publish.callToAction", data.publish.callToAction, "Examples:\n- Reply with your biggest problem.\n- Share this with someone who needs it.", 5))}</div>
        ${aiNotesBox(data)}
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">Swipe file</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Save reusable lines and punchy phrasing.</div>
          </div>
          <span class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">${swipeCount} lines</span>
        </div>

        <div class="mt-4">${field("Best lines (one per line)", "", textarea("publish.swipeLines", data.publish.swipeLines, "Paste your best lines here so they compound over time.", 8))}</div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button id="btnExportMarkdown" class="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" type="button">
            ${icon("download")} Export Markdown
          </button>
          <button id="btnExportJson" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
            ${icon("download")} Export JSON
          </button>
          <button id="btnCopyMarkdown" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
            Copy Markdown
          </button>
          <button id="btnCompleteRound" class="ml-auto inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
            ${icon("check")} Complete round
          </button>
        </div>
      </div>
    </div>
  `;
};

/* ========= Module: Render Shell ========= */
const renderAppShell = () => {
  const round = ensureActiveRound();
  document.documentElement.classList.toggle("dark", !!appState.settings.darkMode);

  qs("#app").innerHTML = `
    <div class="h-full">
      <header class="sticky top-0 z-30 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/70">
        <div class="mx-auto max-w-6xl px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950">
                ${icon("wand")}
              </div>
              <div class="leading-tight">
                <div class="text-sm font-semibold">Newsletter System Wizard</div>
                <div class="text-xs text-zinc-600 dark:text-zinc-400">Value first. Voice as the vehicle.</div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button id="btnAiFill" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60" type="button">
                ${icon("wand")}
                <span class="hidden sm:inline">${appState.ui.aiBusy ? "Filling…" : "Fill with AI"}</span>
              </button>

              <button id="btnAiSettings" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
                ${icon("gear")}
                <span class="hidden sm:inline">AI</span>
              </button>

              <button id="btnLibrary" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
                ${icon("library")}
                <span class="hidden sm:inline">Rounds</span>
              </button>

              <button id="btnNewRound" class="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" type="button">
                ${icon("plus")}
                <span class="hidden sm:inline">New round</span>
              </button>

              <button id="btnTheme" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
                <span class="inline-flex items-center">${appState.settings.darkMode ? icon("sun") : icon("moon")}</span>
                <span class="hidden sm:inline">${appState.settings.darkMode ? "Light" : "Dark"}</span>
              </button>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-zinc-600 dark:text-zinc-400">Active round</div>
              <div class="truncate text-sm font-semibold">
                ${round.name ? escapeHtml(round.name) : "Untitled round"}
                <span class="ml-2 text-xs font-normal text-zinc-600 dark:text-zinc-400">• ${formatDateTime(round.updatedAt)}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button id="btnFocus" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
                ${icon("wand")}
                <span class="hidden sm:inline">Focus</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-4 py-6">
        <div id="mainWrap" class="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <aside id="sidebar" class="scroll-soft overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div class="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <div class="text-sm font-semibold">Your workflow</div>
              <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">One guided pass → one publishable draft.</div>
            </div>

            <nav class="p-2">
              ${steps
                .map((s, idx) => {
                  const active = idx === round.currentStep;
                  return `
                    <button type="button" class="stepBtn group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${active ? "bg-zinc-50 dark:bg-zinc-800/60" : ""}" data-step="${idx}">
                      <div class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        ${idx + 1}
                      </div>
                      <div class="min-w-0">
                        <div class="text-sm font-semibold">${escapeHtml(s.title)}</div>
                        <div class="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">${escapeHtml(s.blurb)}</div>
                      </div>
                    </button>
                  `;
                })
                .join("")}
            </nav>
          </aside>

          <section id="contentCard" class="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div class="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-xs text-zinc-600 dark:text-zinc-400">Step ${round.currentStep + 1} of ${steps.length}</div>
                  <h1 class="mt-1 truncate text-lg font-semibold">${escapeHtml(steps[round.currentStep].title)}</h1>
                </div>
                <div class="flex items-center gap-2">
                  <button id="btnPrev" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">Back</button>
                  <button id="btnNext" class="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" type="button">Next</button>
                </div>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span class="text-xs text-zinc-600 dark:text-zinc-400">AI fill mode:</span>
                <span class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  ${appState.settings.ai.fillMode === "missing" ? "Fill missing only" : "Overwrite all"}
                </span>
                ${safeText(appState.settings.ai.endpoint).trim() ? `<span class="text-xs text-zinc-600 dark:text-zinc-400">• endpoint set</span>` : `<span class="text-xs text-rose-600 dark:text-rose-300">• endpoint not set</span>`}
              </div>
            </div>

            <div id="content" class="p-5"></div>
          </section>
        </div>

        <div id="modalRoot"></div>
      </main>
    </div>
  `;

  renderStepContent();
  bindShellEvents();
  syncAiButtons();
};

/* ========= Module: Step Switch ========= */
const renderStepContent = () => {
  const r = ensureActiveRound();
  const step = steps[r.currentStep];
  const data = r.data;

  const content = qs("#content");
  if (!content) return;

  const view =
    step.id === "topic" ? renderTopicStep(data) :
    step.id === "title" ? renderTitleStep(data) :
    step.id === "research" ? renderResearchStep(data) :
    step.id === "ideation" ? renderIdeationStep(data) :
    step.id === "outline" ? renderOutlineStep(data) :
    step.id === "draft" ? renderDraftStep(data) :
    step.id === "edit" ? renderEditStep(data) :
    step.id === "publish" ? renderPublishStep(data) :
    `<div class="text-sm text-zinc-600 dark:text-zinc-400">Unknown step</div>`;

  content.innerHTML = view;

  const focusAllowed = step.id === "draft" || step.id === "edit";
  qs("#btnFocus")?.classList.toggle("hidden", !focusAllowed);

  syncFocusState();
  bindStepEvents();
  syncAiButtons();
};

/* ========= Module: Autosave ========= */
const bindAutosaveInputs = () => {
  const root = qs("#content");
  if (!root) return;

  qsa("[data-path]", root).forEach((el) => {
    const evt = el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? "input" : "change";
    el.addEventListener(evt, () => {
      const path = el.dataset.path;
      const kind = el.dataset.kind || "text";
      const value = kind === "checkbox" ? el.checked : kind === "number" ? Number(el.value) : el.value;
      updateRoundData(path, value);
      if (!ensureActiveRound().name) ensureActiveRound().name = suggestRoundName(ensureActiveRound().data);
      saveState();
    });
  });
};

/* ========= Module: Outline Controls ========= */
const bindOutlineControls = () => {
  qs("#btnAddSection")?.addEventListener("click", () => {
    const r = ensureActiveRound();
    const sections = Array.isArray(r.data.outline.sections) ? r.data.outline.sections : [];
    sections.push({ title: `Section ${sections.length + 1}`, what: "", how: "", why: "" });
    r.data.outline.sections = sections;
    setRoundUpdated();
    saveState();
    renderStepContent();
  });

  qsa(".btnRemoveSection").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const r = ensureActiveRound();
      const sections = Array.isArray(r.data.outline.sections) ? r.data.outline.sections : [];
      if (!Number.isFinite(idx)) return;
      r.data.outline.sections = sections.filter((_, i) => i !== idx);
      setRoundUpdated();
      saveState();
      renderStepContent();
    });
  });
};

/* ========= Module: Title Controls ========= */
const bindTitleSuggestionControls = () => {
  qsa(".titleSuggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = safeText(btn.dataset.title);
      updateRoundData("title.finalTitle", t);
      const r = ensureActiveRound();
      r.name = suggestRoundName(r.data);
      setRoundUpdated();
      saveState();
      renderAppShell();
    });
  });

  qs("#btnApplyTitleToRound")?.addEventListener("click", () => {
    const r = ensureActiveRound();
    r.name = safeText(r.data.title.finalTitle).trim() || suggestRoundName(r.data);
    setRoundUpdated();
    saveState();
    renderAppShell();
  });
};

/* ========= Module: Draft Controls ========= */
const bindDraftTimerControls = () => {
  const r = ensureActiveRound();
  if (steps[r.currentStep].id !== "draft") return;

  qs("#btnTimerStart")?.addEventListener("click", () => startTimer());
  qs("#btnTimerPause")?.addEventListener("click", () => pauseTimer());
  qs("#btnTimerReset")?.addEventListener("click", () => resetTimer());

  const focusBox = qsa('[data-path="draft.focusMode"]')[0];
  focusBox?.addEventListener("change", () => {
    document.body.dataset.focus = focusBox.checked ? "true" : "false";
  });

  startTimerTick();
};

/* ========= Module: Edit Controls ========= */
const bindEditControls = () => {
  const r = ensureActiveRound();
  if (steps[r.currentStep].id !== "edit") return;

  qsa(".passBtn").forEach((b) =>
    b.addEventListener("click", () => {
      updateRoundData("edits.activePass", safeText(b.dataset.pass));
      renderStepContent();
    })
  );

  qs("#btnSeedFinalFromDraft")?.addEventListener("click", () => {
    const rr = ensureActiveRound();
    if (safeText(rr.data.edits.finalDraft).trim()) return;
    rr.data.edits.finalDraft = safeText(rr.data.draft.text);
    setRoundUpdated();
    saveState();
    renderStepContent();
    toast("Seeded final draft from draft.", "ok");
  });
};

/* ========= Module: Publish Controls ========= */
const bindPublishControls = () => {
  const r = ensureActiveRound();
  if (steps[r.currentStep].id !== "publish") return;

  qs("#btnExportMarkdown")?.addEventListener("click", () => {
    const round = ensureActiveRound();
    const md = buildMarkdown(round.data);
    const name = (safeText(round.data.title.finalTitle).trim() || "newsletter").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
    downloadTextFile(`${name}.md`, md);
  });

  qs("#btnExportJson")?.addEventListener("click", () => {
    const round = ensureActiveRound();
    const name = (safeText(round.data.title.finalTitle).trim() || "newsletter").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
    downloadTextFile(`${name}.json`, JSON.stringify(round, null, 2));
  });

  qs("#btnCopyMarkdown")?.addEventListener("click", async () => {
    const round = ensureActiveRound();
    await copyToClipboard(buildMarkdown(round.data));
    toast("Copied Markdown.", "ok");
  });

  qs("#btnCompleteRound")?.addEventListener("click", () => {
    const r1 = ensureActiveRound();
    r1.updatedAt = nowISO();
    saveState();

    const r2 = createRound();
    appState.rounds.unshift(r2);
    appState.activeRoundId = r2.id;
    saveState();
    document.body.dataset.focus = "false";
    renderAppShell();
    toast("Round completed. New round created.", "ok");
  });
};

/* ========= Module: Focus Mode ========= */
const syncFocusState = () => {
  const r = ensureActiveRound();
  const stepId = steps[r.currentStep].id;
  if (stepId === "draft") {
    document.body.dataset.focus = r.data.draft.focusMode ? "true" : "false";
    return;
  }
  document.body.dataset.focus = "false";
};

/* ========= Module: Modals ========= */
const closeModal = () => {
  const root = qs("#modalRoot");
  if (root) root.innerHTML = "";
};

const openLibraryModal = () => {
  const root = qs("#modalRoot");
  if (!root) return;

  const items = appState.rounds;

  root.innerHTML = `
    <div class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"></div>
    <div class="fixed inset-0 z-50 grid place-items-center p-4">
      <div class="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[var(--shadow-soft)] dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <div class="text-sm font-semibold">Rounds</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Open or delete.</div>
          </div>
          <button id="btnCloseLibrary" class="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">Close</button>
        </div>

        <div class="max-h-[70vh] overflow-auto p-4 scroll-soft">
          ${
            items.length
              ? items
                  .map((r) => {
                    const isActive = r.id === appState.activeRoundId;
                    const title = r.name || "Untitled round";
                    const step = Number.isFinite(r.currentStep) ? r.currentStep : 0;
                    return `
                      <div class="mb-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex items-center gap-2">
                              <div class="truncate text-sm font-semibold">${escapeHtml(title)}</div>
                              ${isActive ? `<span class="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active</span>` : ""}
                            </div>
                            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Updated ${escapeHtml(formatDateTime(r.updatedAt))} • Step ${step + 1}/${steps.length}</div>
                          </div>

                          <div class="flex flex-wrap items-center gap-2">
                            <button class="btnOpenRound rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" type="button" data-id="${escapeHtml(r.id)}">Open</button>
                            <button class="btnDeleteRound rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button" data-id="${escapeHtml(r.id)}">Delete</button>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="text-sm text-zinc-600 dark:text-zinc-400">No rounds yet.</div>`
          }
        </div>
      </div>
    </div>
  `;

  qs("#btnCloseLibrary")?.addEventListener("click", () => closeModal());

  qsa(".btnOpenRound").forEach((b) =>
    b.addEventListener("click", () => {
      const id = safeText(b.dataset.id);
      if (!id) return;
      appState.activeRoundId = id;
      saveState();
      closeModal();
      document.body.dataset.focus = "false";
      renderAppShell();
    })
  );

  qsa(".btnDeleteRound").forEach((b) =>
    b.addEventListener("click", () => {
      const id = safeText(b.dataset.id);
      if (!id) return;
      appState.rounds = appState.rounds.filter((x) => x.id !== id);
      if (!appState.rounds.length) {
        const r = createRound();
        appState.rounds.unshift(r);
        appState.activeRoundId = r.id;
      } else if (appState.activeRoundId === id) {
        appState.activeRoundId = appState.rounds[0].id;
      }
      saveState();
      closeModal();
      openLibraryModal();
    })
  );
};

const openAiSettingsModal = () => {
  const root = qs("#modalRoot");
  if (!root) return;

  const ai = appState.settings.ai;

  root.innerHTML = `
    <div class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"></div>
    <div class="fixed inset-0 z-50 grid place-items-center p-4">
      <div class="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[var(--shadow-soft)] dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <div class="text-sm font-semibold">AI settings</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Recommended: point endpoint to your own Worker/Function proxy.</div>
          </div>
          <button id="btnCloseAi" class="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">Close</button>
        </div>

        <div class="p-5 space-y-4">
          <label class="block">
            <div class="text-sm font-medium">Endpoint URL</div>
            <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Your endpoint must return JSON: {"updates": {...}, "notes": "..."}</div>
            <input id="aiEndpoint" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950" value="${escapeHtml(ai.endpoint)}" placeholder="https://your-worker.example.com/autofill" />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <div class="text-sm font-medium">Provider</div>
              <select id="aiProvider" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950">
                ${AI_PROVIDERS.map((provider) => `
                  <option value="${provider.id}" ${normalizeAiProvider(ai.provider) === provider.id ? "selected" : ""}>${provider.label}</option>
                `).join("")}
              </select>
            </label>

            <label class="block">
              <div class="text-sm font-medium">Model (optional)</div>
              <input id="aiModel" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950" value="${escapeHtml(ai.model)}" placeholder="model name your endpoint expects" />
            </label>

            <label class="block">
              <div class="text-sm font-medium">Timeout (ms)</div>
              <input id="aiTimeout" type="number" min="5000" max="180000" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950" value="${Number(ai.timeoutMs || 45000)}" />
            </label>
          </div>

          <label class="block">
            <div class="text-sm font-medium">API key (optional)</div>
            <div class="mt-1 text-xs text-rose-600 dark:text-rose-300">If you put a real provider key here on GitHub Pages, it can be stolen. Use a proxy endpoint instead.</div>
            <input id="aiKey" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950" value="${escapeHtml(ai.apiKey)}" placeholder="Bearer token (not recommended on public sites)" />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <div class="text-sm font-medium">Fill mode</div>
              <select id="aiFillMode" class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950">
                <option value="missing" ${ai.fillMode === "missing" ? "selected" : ""}>Fill missing only (recommended)</option>
                <option value="all" ${ai.fillMode === "all" ? "selected" : ""}>Overwrite all</option>
              </select>
            </label>

            <label class="block">
              <div class="text-sm font-medium">Allow long draft</div>
              <div class="mt-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <div class="text-sm text-zinc-700 dark:text-zinc-200">AI can write draft text</div>
                <input id="aiAllowDraft" type="checkbox" class="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700" ${ai.allowLongDraft ? "checked" : ""} />
              </div>
            </label>
          </div>

          <div class="flex flex-wrap gap-2 pt-2">
            <button id="btnSaveAi" class="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200" type="button">${icon("check")} Save</button>
            <button id="btnTestAi" class="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">Test endpoint</button>
          </div>

          <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            <div class="font-semibold">Expected response</div>
            <div class="mt-1 text-zinc-600 dark:text-zinc-400">{"updates": {"topic.problemOneLiner": "...", ...}, "notes": "short explanation"} (for OpenAI/Anthropic, return this JSON in the message content)</div>
          </div>
        </div>
      </div>
    </div>
  `;

  qs("#btnCloseAi")?.addEventListener("click", () => closeModal());

  qs("#btnSaveAi")?.addEventListener("click", () => {
    const endpoint = safeText(qs("#aiEndpoint")?.value).trim();
    const model = safeText(qs("#aiModel")?.value).trim();
    const apiKey = safeText(qs("#aiKey")?.value).trim();
    const provider = normalizeAiProvider(safeText(qs("#aiProvider")?.value).trim());
    const fillMode = safeText(qs("#aiFillMode")?.value).trim() || "missing";
    const allowLongDraft = !!qs("#aiAllowDraft")?.checked;
    const timeoutMs = Number(qs("#aiTimeout")?.value) || 45000;

    appState.settings.ai.endpoint = endpoint;
    appState.settings.ai.model = model;
    appState.settings.ai.apiKey = apiKey;
    appState.settings.ai.provider = provider;
    appState.settings.ai.fillMode = fillMode === "all" ? "all" : "missing";
    appState.settings.ai.allowLongDraft = allowLongDraft;
    appState.settings.ai.timeoutMs = clamp(timeoutMs, 5000, 180000);

    saveState();
    closeModal();
    renderAppShell();
    toast("AI settings saved.", "ok");
  });

  qs("#btnTestAi")?.addEventListener("click", async () => {
    const endpoint = safeText(qs("#aiEndpoint")?.value).trim();
    if (!endpoint) { toast("Enter an endpoint URL first.", "bad"); return; }
    try {
      const r = ensureActiveRound();
      const stepId = steps[r.currentStep].id;
      const allowed = AI_FIELDS_BY_STEP[stepId] || [];
      const fillMode = safeText(qs("#aiFillMode")?.value).trim();
      const testSettings = {
        ...appState.settings.ai,
        model: safeText(qs("#aiModel")?.value).trim(),
        apiKey: safeText(qs("#aiKey")?.value).trim(),
        provider: normalizeAiProvider(safeText(qs("#aiProvider")?.value).trim()),
        fillMode: fillMode === "all" ? "all" : "missing",
        allowLongDraft: !!qs("#aiAllowDraft")?.checked,
        timeoutMs: clamp(Number(qs("#aiTimeout")?.value) || 45000, 5000, 180000)
      };
      const req = buildAiRequest(stepId, r.data, allowed, testSettings);
      const headers = buildAiHeaders(req.provider, testSettings.apiKey);
      const payload = buildAiPayload(req, testSettings);

      const resp = await withTimeout(
        fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        }),
        testSettings.timeoutMs
      );

      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const raw = await resp.text();
      parseAiResponse(req.provider, raw, allowed);
      toast("Endpoint looks good (valid JSON).", "ok");
    } catch (e) {
      toast("Test failed: " + (e?.message || "error"), "bad");
    }
  });
};

/* ========= Module: Events ========= */
const bindStepEvents = () => {
  bindAutosaveInputs();
  bindOutlineControls();
  bindTitleSuggestionControls();
  bindDraftTimerControls();
  bindEditControls();
  bindPublishControls();
};

const syncAiButtons = () => {
  const btn = qs("#btnAiFill");
  if (!btn) return;
  btn.disabled = !!appState.ui.aiBusy;
  btn.querySelector("span") && (btn.querySelector("span").textContent = appState.ui.aiBusy ? "Filling…" : "Fill with AI");
};

/* ========= Module: Shell Events ========= */
const bindShellEvents = () => {
  const round = ensureActiveRound();

  const btnPrev = qs("#btnPrev");
  const btnNext = qs("#btnNext");
  if (btnPrev) btnPrev.disabled = round.currentStep <= 0;
  if (btnNext) btnNext.disabled = round.currentStep >= steps.length - 1;

  qs("#btnTheme")?.addEventListener("click", () => {
    appState.settings.darkMode = !appState.settings.darkMode;
    saveState();
    renderAppShell();
  });

  qs("#btnNewRound")?.addEventListener("click", () => {
    const r = createRound();
    appState.rounds.unshift(r);
    appState.activeRoundId = r.id;
    saveState();
    document.body.dataset.focus = "false";
    renderAppShell();
  });

  qs("#btnLibrary")?.addEventListener("click", () => openLibraryModal());

  qs("#btnPrev")?.addEventListener("click", () => {
    const r = ensureActiveRound();
    r.currentStep = clamp(r.currentStep - 1, 0, steps.length - 1);
    setRoundUpdated();
    saveState();
    renderAppShell();
  });

  qs("#btnNext")?.addEventListener("click", () => {
    const r = ensureActiveRound();
    r.currentStep = clamp(r.currentStep + 1, 0, steps.length - 1);
    setRoundUpdated();
    saveState();
    renderAppShell();
  });

  qs("#btnFocus")?.addEventListener("click", () => {
    const enabled = document.body.dataset.focus === "true";
    document.body.dataset.focus = enabled ? "false" : "true";
    const r = ensureActiveRound();
    if (steps[r.currentStep].id === "draft") {
      r.data.draft.focusMode = document.body.dataset.focus === "true";
      setRoundUpdated();
      saveState();
    }
  });

  qsa(".stepBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.step);
      if (!Number.isFinite(idx)) return;
      const r = ensureActiveRound();
      r.currentStep = clamp(idx, 0, steps.length - 1);
      setRoundUpdated();
      saveState();
      renderAppShell();
    });
  });

  qs("#btnAiSettings")?.addEventListener("click", () => openAiSettingsModal());
  qs("#btnAiFill")?.addEventListener("click", () => aiAutofillCurrentStep());
};

/* ========= Module: Init ========= */
const hydrate = () => {
  const r = ensureActiveRound();
  if (!r.name) r.name = suggestRoundName(r.data);
  saveState();
};

hydrate();
renderAppShell();
