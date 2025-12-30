const qs = (s, r = document) => r.querySelector(s)
const qsa = (s, r = document) => [...r.querySelectorAll(s)]

const STORAGE_KEY = "newsletter_system_v1"

const defaultRound = () => ({
  id: crypto.randomUUID(),
  step: 0,
  title: "",
  topic: "",
  research: "",
  insights: "",
  outline: "",
  draft: "",
  final: "",
  updated: Date.now()
})

const state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  dark: false,
  rounds: [defaultRound()],
  active: 0
}

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

const steps = [
  { title: "Validated Topic", key: "topic" },
  { title: "Research", key: "research" },
  { title: "Insights", key: "insights" },
  { title: "Outline", key: "outline" },
  { title: "Draft", key: "draft" },
  { title: "Edit & Final", key: "final" }
]

const render = () => {
  document.documentElement.classList.toggle("dark", state.dark)
  const r = state.rounds[state.active]

  qs("#app").innerHTML = `
    <div class="h-full grid grid-cols-[260px_1fr]" id="mainWrap">
      <aside id="sidebar" class="border-r border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
        ${steps.map((s,i)=>`
          <button class="w-full text-left p-3 rounded-xl ${i===r.step?"bg-zinc-200 dark:bg-zinc-800":""}"
            onclick="goto(${i})">${i+1}. ${s.title}</button>`).join("")}
      </aside>

      <main class="p-6 space-y-4">
        <div class="flex justify-between items-center">
          <h1 class="text-xl font-bold">${steps[r.step].title}</h1>
          <button onclick="toggleTheme()" class="px-3 py-1 border rounded-xl">
            ${state.dark?"Light":"Dark"}
          </button>
        </div>

        <textarea
          class="w-full min-h-[300px] p-4 rounded-xl border dark:bg-zinc-900"
          placeholder="Write here…"
          oninput="update(this.value)"
        >${r[steps[r.step].key]}</textarea>

        <div class="flex justify-between">
          <button onclick="prev()" ${r.step===0?"disabled":""}>Back</button>
          <button onclick="next()" ${r.step===steps.length-1?"disabled":""}>Next</button>
        </div>
      </main>
    </div>
  `
}

window.goto = i => {
  state.rounds[state.active].step = i
  save()
  render()
}

window.update = v => {
  const r = state.rounds[state.active]
  r[steps[r.step].key] = v
  r.updated = Date.now()
  save()
}

window.prev = () => goto(state.rounds[state.active].step - 1)
window.next = () => goto(state.rounds[state.active].step + 1)
window.toggleTheme = () => { state.dark = !state.dark; save(); render() }

render()
