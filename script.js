;(() => {
  /* ---------- Utils ---------- */
  const $ = (sel, root = document) => root.querySelector(sel)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
  const nowISO = () => new Date().toISOString()

  const safeJsonParse = (s) => {
    try {
      return { ok: true, value: JSON.parse(s) }
    } catch (e) {
      return { ok: false, error: e }
    }
  }

  const bytesToB64 = (bytes) => {
    let bin = ""
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  const b64ToBytes = (b64) => {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }

  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  /* ---------- IndexedDB (Key Storage) ---------- */
  const IDB_NAME = "nw_wizard_v1"
  const IDB_STORE = "crypto"
  const IDB_KEY_ID = "wrapKey"

  const openIdb = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

  const idbGet = async (key) => {
    const db = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly")
      const store = tx.objectStore(IDB_STORE)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  const idbSet = async (key, value) => {
    const db = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite")
      const store = tx.objectStore(IDB_STORE)
      const req = store.put(value, key)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  }

  const getOrCreateWrapKey = async () => {
    const existing = await idbGet(IDB_KEY_ID)
    if (existing) return existing

    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    )
    await idbSet(IDB_KEY_ID, key)
    return key
  }

  const encryptString = async (plaintext, aad = "") => {
    const key = await getOrCreateWrapKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
      key,
      enc.encode(plaintext)
    )
    const ctBytes = new Uint8Array(ct)
    const packed = new Uint8Array(iv.length + ctBytes.length)
    packed.set(iv, 0)
    packed.set(ctBytes, iv.length)
    return bytesToB64(packed)
  }

  const decryptString = async (cipherB64, aad = "") => {
    const key = await getOrCreateWrapKey()
    const packed = b64ToBytes(cipherB64)
    const iv = packed.slice(0, 12)
    const ct = packed.slice(12)
    const enc = new TextEncoder()
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
      key,
      ct
    )
    return new TextDecoder().decode(pt)
  }

  const browserAAD = () => {
    const nav = navigator
    return [
      nav.userAgent || "",
      nav.language || "",
      (nav.languages || []).join(","),
      nav.platform || "",
    ].join("|")
  }

  /* ---------- App Schema ---------- */
  const STEPS = [
    {
      id: "topic",
      title: "Validated topic + title",
      desc:
        "Pick something people already click/search for. Your voice is the vehicle; value is the destination.",
      fields: [
        {
          key: "topic",
          label: "Topic (validated problem)",
          type: "text",
          placeholder: "e.g., How to become articulate, How to read deeply, How to think clearly",
          required: true,
        },
        {
          key: "validationEvidence",
          label: "Validation evidence",
          type: "textarea",
          placeholder:
            "Paste links, view counts, trending proof, or a quick note like:\n- YouTube: 3 videos >100k views\n- Substack: 2 posts trending\n- Reddit/Google: common questions",
          required: true,
        },
        {
          key: "audience",
          label: "Who is this for?",
          type: "text",
          placeholder: "e.g., creators who feel stuck writing, people who struggle speaking, lifelong learners",
          required: true,
        },
        {
          key: "titleOptions",
          label: "Title options (1 per line)",
          type: "textarea",
          placeholder: "Write 5–10. Mix proven structures. Then choose one.",
          required: false,
        },
        {
          key: "finalTitle",
          label: "Final title",
          type: "text",
          placeholder: "Your best click-worthy title",
          required: true,
        },
      ],
    },
    {
      id: "research",
      title: "Research + patterns",
      desc:
        "Study titles, not content first. Collect angles and patterns across creators.",
      fields: [
        {
          key: "referenceTitles",
          label: "Reference titles you’re borrowing patterns from (1 per line)",
          type: "textarea",
          placeholder: "Paste 5–10 titles that already performed well.",
          required: true,
        },
        {
          key: "sources",
          label: "Sources / links (optional)",
          type: "textarea",
          placeholder: "Paste links, books, podcasts, essays—anything you’ll draw from.",
          required: false,
        },
        {
          key: "patternNotes",
          label: "What patterns do you see?",
          type: "textarea",
          placeholder:
            "What makes these clickable?\nWhat emotions do they trigger?\nWhat promise do they make?",
          required: true,
        },
      ],
    },
    {
      id: "ideate",
      title: "Ideation (unique perspective)",
      desc:
        "Generate raw building blocks. Your job is to connect your interests to the validated topic.",
      fields: [
        {
          key: "uniqueAngle",
          label: "Your unique angle / lens",
          type: "textarea",
          placeholder:
            "What do you believe that most takes are missing?\nWhat personal struggle or story proves it?",
          required: true,
        },
        {
          key: "ideaBank",
          label: "Idea bank (bullets)",
          type: "textarea",
          placeholder:
            "- harsh truth\n- metaphor\n- curiosity gap\n- quote\n- counterintuitive insight\n- actionable step",
          required: true,
        },
        {
          key: "supportingBits",
          label: "Quotes / anecdotes / metaphors (optional)",
          type: "textarea",
          placeholder:
            "Drop in the punchy supporting pieces you might weave in later.",
          required: false,
        },
      ],
    },
    {
      id: "outline",
      title: "Outline (problem → insight → solution)",
      desc:
        "Outline is 80% of the work. Don’t draft until the outline is done.",
      fields: [
        {
          key: "problemSection",
          label: "Problem (paint the pain)",
          type: "textarea",
          placeholder:
            "What’s the enemy?\nWhat’s the cost of staying the same?\nMake it vivid.",
          required: true,
        },
        {
          key: "insightSection",
          label: "Insights (new perspective)",
          type: "textarea",
          placeholder:
            "List 1–3 core insights. Each should cause a 'click' in the reader’s mind.",
          required: true,
        },
        {
          key: "solutionSection",
          label: "Solution / framework (steps)",
          type: "textarea",
          placeholder:
            "Give a clear process the reader can follow.\nNumbered steps work well.",
          required: true,
        },
        {
          key: "sectionFlow",
          label: "Section flow (What → How → Why)",
          type: "textarea",
          placeholder:
            "For each section, jot:\nWHAT you’ll say\nHOW you’ll explain\nWHY it matters",
          required: false,
        },
      ],
    },
    {
      id: "draft",
      title: "Draft (write without editing)",
      desc:
        "Write fast from the outline. No judgment. No editing until the draft exists.",
      fields: [
        {
          key: "hook",
          label: "Hook (first 3–6 lines)",
          type: "textarea",
          placeholder:
            "Open with tension, curiosity, or a harsh truth. Make the promise obvious.",
          required: true,
        },
        {
          key: "draftText",
          label: "Draft body",
          type: "textarea",
          placeholder:
            "Write the full newsletter here. Keep moving. You can fix it later.",
          required: true,
        },
        {
          key: "cta",
          label: "CTA (call to action)",
          type: "text",
          placeholder: "e.g., reply with X, subscribe, share, download, comment",
          required: false,
        },
      ],
    },
    {
      id: "edit",
      title: "Edit + publish",
      desc:
        "Tighten logic, remove fluff, make the steps obvious, then publish.",
      fields: [
        {
          key: "editPass",
          label: "Edit notes (what to tighten / cut / clarify)",
          type: "textarea",
          placeholder:
            "What’s unclear?\nWhat’s repetitive?\nWhere does the logic jump?",
          required: true,
        },
        {
          key: "finalNewsletter",
          label: "Final newsletter",
          type: "textarea",
          placeholder: "Paste your final version here (or AI can help refine it).",
          required: true,
        },
        {
          key: "publishNotes",
          label: "Publish notes (title, subtitle, thumbnail idea)",
          type: "textarea",
          placeholder:
            "Anything you need for posting: subtitle, featured image idea, tags, etc.",
          required: false,
        },
      ],
    },
  ]

  /* ---------- Storage ---------- */
  const LS_SETTINGS = "nw_settings_v1"
  const LS_STATE = "nw_state_v1"

  const defaultSettings = () => ({
    endpoint: "https://api.openai.com/v1/responses",
    model: "gpt-4.1-mini",
    temperature: 0.7,
    apiKeyCipher: null,
    hasKey: false,
  })

  const defaultState = () => ({
    version: 1,
    stepIndex: 0,
    updatedAt: nowISO(),
    data: Object.fromEntries(
      STEPS.flatMap((s) => s.fields.map((f) => [f.key, ""]))
    ),
  })

  const loadSettings = () => {
    const raw = localStorage.getItem(LS_SETTINGS)
    if (!raw) return defaultSettings()
    const parsed = safeJsonParse(raw)
    if (!parsed.ok) return defaultSettings()
    const s = { ...defaultSettings(), ...parsed.value }
    s.endpoint = typeof s.endpoint === "string" && s.endpoint.trim() ? s.endpoint : defaultSettings().endpoint
    s.model = typeof s.model === "string" && s.model.trim() ? s.model : defaultSettings().model
    s.temperature = Number.isFinite(Number(s.temperature)) ? clamp(Number(s.temperature), 0, 2) : defaultSettings().temperature
    s.hasKey = !!s.apiKeyCipher
    return s
  }

  const loadState = () => {
    const raw = localStorage.getItem(LS_STATE)
    if (!raw) return defaultState()
    const parsed = safeJsonParse(raw)
    if (!parsed.ok) return defaultState()
    const st = { ...defaultState(), ...parsed.value }
    st.stepIndex = clamp(Number(st.stepIndex) || 0, 0, STEPS.length - 1)
    st.updatedAt = st.updatedAt || nowISO()
    st.data = { ...defaultState().data, ...(st.data || {}) }
    return st
  }

  const saveSettings = (settings) => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings))
  }

  const saveState = (state) => {
    state.updatedAt = nowISO()
    localStorage.setItem(LS_STATE, JSON.stringify(state))
  }

  /* ---------- OpenAI ---------- */
  const extractOutputText = (respJson) => {
    if (typeof respJson?.output_text === "string" && respJson.output_text.trim()) return respJson.output_text
    const out = respJson?.output
    if (!Array.isArray(out)) return ""
    const chunks = []
    for (const item of out) {
      if (item?.type !== "message") continue
      const content = item?.content
      if (!Array.isArray(content)) continue
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") chunks.push(c.text)
      }
    }
    return chunks.join("\n").trim()
  }

  const openaiCreate = async ({ endpoint, apiKey, model, temperature, instructions, input, maxOutputTokens }) => {
    const body = {
      model,
      temperature,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      truncation: "auto",
      store: false,
      text: { format: { type: "json_object" } },
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      const msg =
        json?.error?.message ||
        json?.message ||
        `Request failed (${res.status})`
      const err = new Error(msg)
      err.status = res.status
      err.payload = json
      throw err
    }

    return json
  }

  /* ---------- UI State ---------- */
  let settings = loadSettings()
  let state = loadState()
  let saveTimer = null

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        saveState(state)
        renderSaveMeta()
      } catch (e) {
        renderSaveMeta(`Save failed: ${e?.message || "quota?"}`)
      }
    }, 250)
  }

  const isStepDone = (step) => {
    for (const f of step.fields) {
      if (!f.required) continue
      const v = String(state.data[f.key] || "").trim()
      if (!v) return false
    }
    return true
  }

  const getFinalText = () => {
    const final = String(state.data.finalNewsletter || "").trim()
    if (final) return final
    const draft = String(state.data.draftText || "").trim()
    const hook = String(state.data.hook || "").trim()
    const title = String(state.data.finalTitle || "").trim()
    const bits = []
    if (title) bits.push(title)
    if (hook) bits.push(hook)
    if (draft) bits.push(draft)
    return bits.join("\n\n").trim()
  }

  /* ---------- Render ---------- */
  const stepListEl = $("#stepList")
  const stepTitleEl = $("#stepTitle")
  const stepDescEl = $("#stepDesc")
  const stepMetaEl = $("#stepMeta")
  const stepFormEl = $("#stepForm")
  const finalPreviewEl = $("#finalPreview")
  const saveMetaEl = $("#saveMeta")

  const qTitleEl = $("#qTitle")
  const qAngleEl = $("#qAngle")
  const qCTAEl = $("#qCTA")

  const aiStatusEl = $("#aiStatus")

  const renderSaveMeta = (errText = "") => {
    if (errText) {
      saveMetaEl.textContent = errText
      return
    }
    const dt = new Date(state.updatedAt)
    saveMetaEl.textContent = `Last saved: ${dt.toLocaleString()}`
  }

  const renderQuick = () => {
    const t = String(state.data.finalTitle || "").trim() || "—"
    const a = String(state.data.uniqueAngle || "").trim() || "—"
    const c = String(state.data.cta || "").trim() || "—"
    qTitleEl.textContent = t
    qAngleEl.textContent = a
    qCTAEl.textContent = c
  }

  const renderFinalPreview = () => {
    const text = getFinalText()
    finalPreviewEl.textContent = text || "—"
  }

  const renderSteps = () => {
    stepListEl.innerHTML = ""
    const doneCount = STEPS.filter(isStepDone).length
    stepMetaEl.textContent = `${doneCount}/${STEPS.length} complete`

    STEPS.forEach((s, idx) => {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "step-btn"
      btn.dataset.step = String(idx)

      const dot = document.createElement("div")
      dot.className = "step-dot"
      if (idx === state.stepIndex) dot.classList.add("active")
      if (isStepDone(s)) dot.classList.add("done")

      const textWrap = document.createElement("div")
      textWrap.className = "min-w-0"
      const title = document.createElement("div")
      title.className = "text-sm font-semibold text-zinc-100 truncate"
      title.textContent = s.title
      const sub = document.createElement("div")
      sub.className = "text-xs text-zinc-400 truncate"
      sub.textContent = s.id

      textWrap.appendChild(title)
      textWrap.appendChild(sub)

      btn.appendChild(dot)
      btn.appendChild(textWrap)

      stepListEl.appendChild(btn)
    })
  }

  const fieldTemplate = (field, value) => {
    const wrap = document.createElement("div")
    wrap.className = "field"

    const label = document.createElement("label")
    label.className = "field-label"
    label.textContent = field.required ? `${field.label} *` : field.label
    label.htmlFor = field.key

    let input
    if (field.type === "textarea") {
      input = document.createElement("textarea")
      input.className = "textarea"
      input.rows = 7
    } else {
      input = document.createElement("input")
      input.className = "input"
      input.type = "text"
    }

    input.id = field.key
    input.name = field.key
    input.placeholder = field.placeholder || ""
    input.value = value || ""

    wrap.appendChild(label)
    wrap.appendChild(input)
    return wrap
  }

  const renderStep = () => {
    const step = STEPS[state.stepIndex]
    stepTitleEl.textContent = step.title
    stepDescEl.textContent = step.desc

    stepFormEl.innerHTML = ""
    for (const f of step.fields) {
      stepFormEl.appendChild(fieldTemplate(f, state.data[f.key] || ""))
    }

    $("#btnBack").disabled = state.stepIndex === 0
    $("#btnNext").textContent = state.stepIndex === STEPS.length - 1 ? "Finish" : "Next"

    renderQuick()
    renderFinalPreview()
    renderSaveMeta()
  }

  const renderAll = () => {
    renderSteps()
    renderStep()
  }

  /* ---------- Settings Modal ---------- */
  const settingsModal = $("#settingsModal")
  const exportModal = $("#exportModal")

  const renderKeyStatus = () => {
    const el = $("#keyStatus")
    el.textContent = settings.apiKeyCipher ? "Key saved on this device" : "No key saved"
  }

  const openSettings = () => {
    $("#settingEndpoint").value = settings.endpoint
    $("#settingModel").value = settings.model
    $("#settingTemp").value = String(settings.temperature)
    $("#settingApiKey").value = ""
    renderKeyStatus()
    settingsModal.showModal()
  }

  const closeSettings = () => {
    settingsModal.close()
  }

  const saveSettingsFromUI = async () => {
    const endpoint = String($("#settingEndpoint").value || "").trim()
    const model = String($("#settingModel").value || "").trim()
    const temp = clamp(Number($("#settingTemp").value || "0.7"), 0, 2)
    const apiKeyRaw = String($("#settingApiKey").value || "").trim()

    settings.endpoint = endpoint || defaultSettings().endpoint
    settings.model = model || defaultSettings().model
    settings.temperature = Number.isFinite(temp) ? temp : defaultSettings().temperature

    if (apiKeyRaw) {
      const cipher = await encryptString(apiKeyRaw, browserAAD())
      settings.apiKeyCipher = cipher
      settings.hasKey = true
    } else {
      settings.hasKey = !!settings.apiKeyCipher
    }

    saveSettings(settings)
    renderKeyStatus()
    closeSettings()
  }

  const clearSavedKey = async () => {
    settings.apiKeyCipher = null
    settings.hasKey = false
    saveSettings(settings)
    renderKeyStatus()
  }

  const getApiKey = async () => {
    if (!settings.apiKeyCipher) return ""
    try {
      const key = await decryptString(settings.apiKeyCipher, browserAAD())
      return String(key || "")
    } catch {
      return ""
    }
  }

  const testApi = async () => {
    const status = $("#keyStatus")
    status.textContent = "Testing…"
    const apiKey = await getApiKey()
    if (!apiKey) {
      status.textContent = "No key saved (or decryption failed)"
      return
    }

    try {
      const resp = await openaiCreate({
        endpoint: settings.endpoint,
        apiKey,
        model: settings.model,
        temperature: settings.temperature,
        instructions: "You are a helpful assistant.",
        input: "Return a JSON object with one key: ok=true",
        maxOutputTokens: 120,
      })

      const text = extractOutputText(resp)
      const parsed = safeJsonParse(text)
      if (parsed.ok && parsed.value && parsed.value.ok === true) {
        status.textContent = "API OK ✅"
      } else {
        status.textContent = "API responded, but output wasn’t as expected"
      }
    } catch (e) {
      status.textContent = `API error: ${e?.message || "unknown"}`
    }
  }

  /* ---------- Export Modal ---------- */
  const openExport = () => {
    const md = buildMarkdown()
    $("#mdPreview").textContent = md || "—"
    exportModal.showModal()
  }

  const closeExport = () => exportModal.close()

  const buildMarkdown = () => {
    const lines = []
    const title = String(state.data.finalTitle || "").trim()
    if (title) lines.push(`# ${title}`, "")

    for (const step of STEPS) {
      lines.push(`## ${step.title}`)
      for (const f of step.fields) {
        const v = String(state.data[f.key] || "").trim()
        if (!v) continue
        lines.push(`### ${f.label}`, "", v, "")
      }
      lines.push("")
    }

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
  }

  /* ---------- AI Autofill ---------- */
  const setAiStatus = (text, kind = "info") => {
    aiStatusEl.classList.remove("hidden")
    aiStatusEl.textContent = text
    aiStatusEl.dataset.kind = kind
  }

  const clearAiStatus = () => {
    aiStatusEl.classList.add("hidden")
    aiStatusEl.textContent = ""
  }

  const buildAiInstructions = (step) => {
    return [
      "You are a newsletter-writing assistant that helps users complete a guided workflow.",
      "Return ONLY a JSON object.",
      "You must only use the keys provided in the schema. Do not add extra keys.",
      "Fill in missing/empty fields with concise, high-quality content.",
      "If a field is already filled, return an empty string for that field (do not overwrite).",
      "Keep titles punchy and clickable. Keep steps actionable.",
      "No markdown fences. No commentary. JSON only.",
      "",
      `Step: ${step.title}`,
    ].join("\n")
  }

  const buildAiInput = (step) => {
    const filled = {}
    const schema = {}
    for (const f of step.fields) {
      const current = String(state.data[f.key] || "")
      filled[f.key] = current
      schema[f.key] = {
        label: f.label,
        required: !!f.required,
        type: f.type,
      }
    }

    const context = {
      now: nowISO(),
      workflow: "validated topic → research → ideate → outline → draft → edit",
      global_context: {
        topic: state.data.topic || "",
        audience: state.data.audience || "",
        finalTitle: state.data.finalTitle || "",
        uniqueAngle: state.data.uniqueAngle || "",
        outline: {
          problem: state.data.problemSection || "",
          insights: state.data.insightSection || "",
          solution: state.data.solutionSection || "",
        },
      },
      step_schema: schema,
      current_values: filled,
    }

    return JSON.stringify(context)
  }

  const mergeAiFill = (step, aiObj) => {
    const allowed = new Set(step.fields.map((f) => f.key))
    for (const key of Object.keys(aiObj || {})) {
      if (!allowed.has(key)) continue
      const current = String(state.data[key] || "").trim()
      if (current) continue
      const incoming = String(aiObj[key] || "").trim()
      if (!incoming) continue
      state.data[key] = incoming
    }
  }

  const aiAutofillCurrentStep = async () => {
    const btn = $("#btnAiFill")
    btn.disabled = true
    clearAiStatus()

    const step = STEPS[state.stepIndex]
    const apiKey = await getApiKey()
    if (!apiKey) {
      setAiStatus("No API key saved. Open Settings and save your key first.", "error")
      btn.disabled = false
      return
    }

    setAiStatus("Thinking…")

    try {
      const resp = await openaiCreate({
        endpoint: settings.endpoint,
        apiKey,
        model: settings.model,
        temperature: settings.temperature,
        instructions: buildAiInstructions(step),
        input: buildAiInput(step),
        maxOutputTokens: 900,
      })

      const text = extractOutputText(resp)
      const parsed = safeJsonParse(text)

      if (!parsed.ok) {
        setAiStatus("AI returned invalid JSON. Try again with shorter inputs.", "error")
        btn.disabled = false
        return
      }

      mergeAiFill(step, parsed.value)
      scheduleSave()
      renderAll()
      setAiStatus("Filled empty fields ✅")
      await sleep(900)
      clearAiStatus()
    } catch (e) {
      setAiStatus(`AI error: ${e?.message || "unknown"}`, "error")
    } finally {
      btn.disabled = false
    }
  }

  /* ---------- Events ---------- */
  stepListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-step]")
    if (!btn) return
    const idx = Number(btn.dataset.step)
    state.stepIndex = clamp(idx, 0, STEPS.length - 1)
    scheduleSave()
    renderAll()
  })

  stepFormEl.addEventListener("input", (e) => {
    const el = e.target
    if (!el?.name) return
    state.data[el.name] = el.value
    scheduleSave()
    renderSteps()
    renderQuick()
    renderFinalPreview()
  })

  $("#btnBack").addEventListener("click", () => {
    state.stepIndex = clamp(state.stepIndex - 1, 0, STEPS.length - 1)
    scheduleSave()
    renderAll()
  })

  $("#btnNext").addEventListener("click", () => {
    state.stepIndex = clamp(state.stepIndex + 1, 0, STEPS.length - 1)
    scheduleSave()
    renderAll()
  })

  $("#btnAiFill").addEventListener("click", aiAutofillCurrentStep)

  $("#btnSettings").addEventListener("click", openSettings)
  $("#btnCloseSettings").addEventListener("click", closeSettings)
  $("#btnSaveSettings").addEventListener("click", saveSettingsFromUI)
  $("#btnClearKey").addEventListener("click", clearSavedKey)
  $("#btnTestApi").addEventListener("click", testApi)

  $("#btnExport").addEventListener("click", openExport)
  $("#btnCloseExport").addEventListener("click", closeExport)

  $("#btnDlJson").addEventListener("click", () => {
    const payload = { settings: { ...settings, apiKeyCipher: null, hasKey: settings.hasKey }, state }
    downloadText("newsletter-wizard-session.json", JSON.stringify(payload, null, 2))
  })

  $("#btnDlMd").addEventListener("click", () => {
    downloadText("newsletter.md", buildMarkdown())
  })

  $("#btnReset").addEventListener("click", () => {
    state = defaultState()
    saveState(state)
    renderAll()
  })

  $("#btnCopyFinal").addEventListener("click", async () => {
    const ok = await copyToClipboard(getFinalText())
    if (!ok) return
    $("#btnCopyFinal").textContent = "Copied"
    setTimeout(() => ($("#btnCopyFinal").textContent = "Copy"), 800)
  })

  /* ---------- Boot ---------- */
  renderAll()
  renderKeyStatus()
})()
