// ============================================================================
// Studienablaufplan (Master Informatik) – loaded BEFORE content.js.
// Uses globals from content.js (state, rows, allTags, refreshAll, ...) at runtime only.
// ============================================================================

// Tag names the plan slots look for. Rename them here if you tag differently.
const PLAN_TAG = {
  inf:  "Informatik",
  ang:  "Angewandte Inf.",
  prak: "Praktische Inf.",
  theo: "Theoretische Inf.",
  tech: "Technische Inf.",
  ni:   "NI",
  pg:   "Projektgruppe",
  abs:  "Abschlussmodul",
  uebung: "Übung",   // courses with this tag follow the main course of the same name into the plan
};
const ALL_INF = [PLAN_TAG.inf, PLAN_TAG.ang, PLAN_TAG.prak, PLAN_TAG.theo, PLAN_TAG.tech];

// sem = row, col = column (1-5), cs/rs = column/row span, kp = credit points, accepts = tags that fit
const PLAN_SLOTS = [
  // 1. Semester
  { id: "free-1", type: "free", label: "Freie Akzentwahl Informatik", kp: 6, sem: 1, col: 1, cs: 1, rs: 1, accepts: ALL_INF },
  { id: "free-2", type: "free", label: "Freie Akzentwahl Informatik", kp: 6, sem: 1, col: 2, cs: 1, rs: 1, accepts: ALL_INF },
  { id: "ang",    type: "acc",  label: "Akzentwahl Angewandte Inf.",  kp: 6, sem: 1, col: 3, cs: 1, rs: 1, accepts: [PLAN_TAG.ang] },
  { id: "prak",   type: "acc",  label: "Akzentwahl Praktische Inf.",  kp: 6, sem: 1, col: 4, cs: 1, rs: 1, accepts: [PLAN_TAG.prak] },
  { id: "ni-1",   type: "ni",   label: "NI-Wahl",                     kp: 6, sem: 1, col: 5, cs: 1, rs: 1, accepts: [PLAN_TAG.ni] },
  // 2. Semester (Projektgruppe runs through semesters 2 and 3)
  { id: "pg",     type: "pg",   label: "Projektgruppe",               kp: 24, sem: 2, col: 1, cs: 2, rs: 2, accepts: [PLAN_TAG.pg] },
  { id: "theo",   type: "acc",  label: "Akzentwahl Theoretische Inf.", kp: 6, sem: 2, col: 3, cs: 1, rs: 1, accepts: [PLAN_TAG.theo] },
  { id: "tech",   type: "acc",  label: "Akzentwahl Technische Inf.",  kp: 6, sem: 2, col: 4, cs: 1, rs: 1, accepts: [PLAN_TAG.tech] },
  { id: "ni-2",   type: "ni",   label: "NI-Wahl",                     kp: 6, sem: 2, col: 5, cs: 1, rs: 1, accepts: [PLAN_TAG.ni] },
  // 3. Semester
  { id: "free-3", type: "free", label: "Freie Akzentwahl Informatik", kp: 6, sem: 3, col: 3, cs: 1, rs: 1, accepts: ALL_INF },
  { id: "free-4", type: "free", label: "Freie Akzentwahl Informatik", kp: 6, sem: 3, col: 4, cs: 1, rs: 1, accepts: ALL_INF },
  { id: "free-5", type: "free", label: "Freie Akzentwahl Informatik", kp: 6, sem: 3, col: 5, cs: 1, rs: 1, accepts: ALL_INF },
  // 4. Semester
  { id: "abs",    type: "abs",  label: "Abschlussmodul",              kp: 30, sem: 4, col: 1, cs: 5, rs: 1, accepts: [PLAN_TAG.abs] },
];
const PLAN_TOTAL_KP = 120;

// Effective position of a slot: the user may have swapped blocks (state.planLayout), else the default.
function slotPos(slot) { return state.planLayout[slot.id] || { sem: slot.sem, col: slot.col }; }
function slotSem(slot) { return slotPos(slot).sem; }
const isSwappable = (slot) => slot.cs === 1 && slot.rs === 1;
let dragSlotId = null;

let planSel = null;   // course currently being placed: { id, number, name }
let planMsg = "";
let lastPlanSig = "";

const norm = (s) => String(s).trim().toLowerCase();

function planStore() { return storageSet({ studyPlan: state.plan }); }
function planOpenStore() { return storageSet({ planOpen: state.planOpen }); }

function courseInfo(row) {
  return {
    id: row.dataset.courseId,
    number: row.querySelector("td:nth-child(3)")?.textContent.trim() || "",
    name: row.querySelector("td:nth-child(4) a")?.textContent.trim() || "",
  };
}
function placedSlotOf(courseId) {
  return PLAN_SLOTS.find((s) => state.plan[s.id]?.id === courseId);
}
function planTagName(base) { return state.planAlias[base] || base; }
function slotAccepts(slot) { return slot.accepts.map(planTagName); }
// Name used to match an Übung with its main course (ignores case, extra spaces, a trailing "(fällt aus)")
function normName(n) {
  return String(n || "").replace(/\s*\(fällt aus\)\s*$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
}
// Which plan slot does a course belong to? Directly placed, or – if it is tagged "Übung" –
// via a planned course with the same name. Returns { slot, grouped } or null.
function planSlotFor(id, name, tags) {
  const direct = id ? placedSlotOf(id) : null;
  if (direct) return { slot: direct, grouped: false };
  const g = norm(planTagName(PLAN_TAG.uebung));
  if (!name || !tags.some((t) => norm(t) === g)) return null;
  const n = normName(name);
  const main = PLAN_SLOTS.find((sl) => {
    const e = state.plan[sl.id];
    return e && e.id !== id && normName(e.name) === n;
  });
  return main ? { slot: main, grouped: true } : null;
}
function slotFits(slot, tags) {
  const t = new Set(tags.map(norm));
  return slotAccepts(slot).some((a) => t.has(norm(a)));
}
function selContext() {
  if (!planSel) return null;
  const row = rows().find((r) => r.dataset.courseId === planSel.id);
  return { unknown: !row, tags: row ? allTags(row) : [] };
}
function fitsSelection(slot) {
  const ctx = selContext();
  return !!ctx && (ctx.unknown || slotFits(slot, ctx.tags));
}

// ---------- actions ----------
function startPlacing(info) {
  planSel = info;
  planMsg = "";
  state.planOpen = true;
  planOpenStore();
  renderPlan();
  document.getElementById("sct-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function cancelPlacing() {
  planSel = null;
  renderPlan();
}
async function placeInSlot(slot, info) {
  if (info.id) {
    PLAN_SLOTS.forEach((s) => { if (state.plan[s.id]?.id === info.id) delete state.plan[s.id]; });
  }
  state.plan[slot.id] = { id: info.id || null, number: info.number || "", name: info.name };
  planSel = null;
  planMsg = "";
  await planStore();
  refreshAll();
}
async function swapSlots(idA, idB) {
  const a = PLAN_SLOTS.find((x) => x.id === idA);
  const b = PLAN_SLOTS.find((x) => x.id === idB);
  if (!a || !b || a === b || !isSwappable(a) || !isSwappable(b)) return;
  const pa = slotPos(a), pb = slotPos(b);
  [[a, pb], [b, pa]].forEach(([slot, pos]) => {
    if (pos.sem === slot.sem && pos.col === slot.col) delete state.planLayout[slot.id]; // back to default
    else state.planLayout[slot.id] = { sem: pos.sem, col: pos.col };
  });
  await storageSet({ planLayout: state.planLayout });
  refreshAll();
}
async function resetLayout() {
  state.planLayout = {};
  await storageSet({ planLayout: state.planLayout });
  refreshAll();
}
async function clearSlot(slot) {
  delete state.plan[slot.id];
  await planStore();
  refreshAll();
}
function filterForSlot(slot) {
  const want = new Set(slotAccepts(slot).map(norm));
  const actual = new Set();
  rows().forEach((r) => allTags(r).forEach((t) => { if (want.has(norm(t))) actual.add(t); }));
  if (!actual.size) {
    planMsg = `No courses tagged ${slotAccepts(slot).map((a) => `“${a}”`).join(", ")} yet.`;
    renderPlan();
    return;
  }
  planMsg = "";
  state.active = new Set(actual);
  state.mode = "any";
  lastBarSig = "";
  refreshAll();
  document.getElementById("sct-bar")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function onSlotClick(slot) {
  if (planSel) {
    if (!fitsSelection(slot) &&
        !confirm(`“${planSel.name}” has no tag matching “${slot.label}”.\nPlace it here anyway?`)) return;
    placeInSlot(slot, planSel);
    return;
  }
  if (!state.plan[slot.id]) filterForSlot(slot);
}

// ---------- button next to each course ----------
function makePlanButton(row) {
  const info = courseInfo(row);
  const hit = planSlotFor(info.id, info.name, allTags(row));
  const slot = hit && hit.slot;
  const b = document.createElement("button");
  b.className = "sct-add sct-plan" + (slot ? " sct-placed" : "") + (hit && hit.grouped ? " sct-grouped" : "");
  b.textContent = slot ? `▦ ${slotSem(slot)}. Sem` : "▦ plan";
  b.title = !slot ? "Place this course in the Studienablaufplan"
    : hit.grouped ? `Follows the main course of the same name in: ${slot.label}`
    : `In plan: ${slot.label} (click to move)`;
  b.addEventListener("click", (e) => { e.preventDefault(); startPlacing(info); });
  return b;
}

// ---------- rendering ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderPlan() {
  const bar = document.getElementById("sct-bar");
  if (!bar) return;
  let box = document.getElementById("sct-plan");
  if (!box) { box = document.createElement("div"); box.id = "sct-plan"; }
  if (!box.isConnected || box.nextElementSibling !== bar) bar.parentElement.insertBefore(box, bar);

  const ctx = selContext();
  const sig = JSON.stringify([state.plan, state.planLayout, state.planOpen, planSel, ctx, planMsg]);
  if (sig === lastPlanSig && box.childElementCount) return;
  lastPlanSig = sig;

  const kp = PLAN_SLOTS.reduce((sum, s) => sum + (state.plan[s.id] ? s.kp : 0), 0);

  // header
  const head = el("div", "sct-plan-head");
  const toggle = el("button", "sct-mode", `${state.planOpen ? "▾" : "▸"} Studienablaufplan`);
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    state.planOpen = !state.planOpen;
    planOpenStore();
    renderPlan();
  });
  head.append(toggle);

  const prog = el("div", "sct-progress");
  const fill = el("div", "sct-progress-fill");
  fill.style.width = `${Math.min(100, (kp / PLAN_TOTAL_KP) * 100)}%`;
  prog.append(fill);
  head.append(prog, el("span", "sct-hint", `${kp} / ${PLAN_TOTAL_KP} KP planned`));

  if (planSel) {
    head.append(el("span", "sct-sel", `Placing “${planSel.name}” – click a highlighted slot`));
    const cancel = el("button", "sct-mode", "cancel");
    cancel.addEventListener("click", (e) => { e.preventDefault(); cancelPlacing(); });
    head.append(cancel);
  } else if (planMsg) {
    head.append(el("span", "sct-hint sct-warn", planMsg));
  } else if (state.planOpen) {
    head.append(el("span", "sct-hint", "Click “▦ plan” on a course, click an empty slot to list matching courses, or drag a block onto another to swap them."));
  }

  if (Object.keys(state.planLayout).length) {
    const rl = el("button", "sct-mode sct-right", "reset layout");
    rl.title = "Put all blocks back to their original positions";
    rl.addEventListener("click", (e) => { e.preventDefault(); resetLayout(); });
    head.append(rl);
  }
  const reset = el("button", "sct-mode" + (Object.keys(state.planLayout).length ? "" : " sct-right"), "clear plan");
  reset.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!Object.keys(state.plan).length || !confirm("Remove all courses from the plan? (Tags are kept.)")) return;
    state.plan = {};
    planSel = null;
    await planStore();
    refreshAll();
  });
  head.append(reset);

  const frag = document.createDocumentFragment();
  frag.append(head);

  // grid
  if (state.planOpen) {
    const wrap = el("div", "sct-grid-wrap");
    const grid = el("div", "sct-grid");
    for (let sem = 1; sem <= 4; sem++) {
      const l = el("div", "sct-sem", `${sem}. Sem.`);
      l.style.gridColumn = "1";
      l.style.gridRow = String(sem);
      grid.append(l);
    }
    PLAN_SLOTS.forEach((slot) => {
      const filled = state.plan[slot.id];
      const fit = planSel ? fitsSelection(slot) : false;
      const cls = ["sct-slot", `sct-t-${slot.type}`];
      if (planSel) cls.push(fit ? "sct-fit" : "sct-no");
      const s = el("div", cls.join(" "));
      const pos = slotPos(slot);
      s.style.gridColumn = `${pos.col + 1} / span ${slot.cs}`;
      s.style.gridRow = `${pos.sem} / span ${slot.rs}`;
      s.title = `${slot.label} · accepts tags: ${slotAccepts(slot).join(", ")}`;
      s.append(el("div", "sct-slot-label", slot.label), el("div", "sct-slot-kp", `${slot.kp} KP`));

      if (filled) {
        const c = el("div", "sct-course");
        const name = el("span", "sct-course-name", (filled.number ? filled.number + " " : "") + filled.name);
        name.title = filled.name + (filled.id ? " (click to move)" : "");
        if (filled.id) {
          name.classList.add("sct-movable");
          name.addEventListener("click", (e) => {
            e.stopPropagation();
            startPlacing({ id: filled.id, number: filled.number, name: filled.name });
          });
        }
        const x = el("span", "sct-x", "×");
        x.title = "Remove from plan";
        x.addEventListener("click", (e) => { e.stopPropagation(); clearSlot(slot); });
        c.append(name, x);
        s.append(c);
      } else {
        const manual = el("button", "sct-edit", "✎");
        manual.title = "Enter a course name manually";
        manual.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const name = prompt(`Course name for “${slot.label}”:`);
          if (name && name.trim()) placeInSlot(slot, { id: null, name: name.trim() });
        });
        s.append(manual);
        if (!planSel) s.classList.add("sct-clickable");
      }
      s.addEventListener("click", () => onSlotClick(slot));

      // drag & drop: swap two blocks (only 1x1 blocks; Projektgruppe and Abschlussmodul stay put)
      if (isSwappable(slot)) {
        if (!planSel) { s.draggable = true; s.classList.add("sct-drag"); }
        s.addEventListener("dragstart", (e) => {
          dragSlotId = slot.id;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", slot.id);
          s.classList.add("sct-dragging");
        });
        s.addEventListener("dragend", () => {
          dragSlotId = null;
          s.classList.remove("sct-dragging");
          document.querySelectorAll(".sct-drop").forEach((n) => n.classList.remove("sct-drop"));
        });
        s.addEventListener("dragover", (e) => {
          if (dragSlotId && dragSlotId !== slot.id) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            s.classList.add("sct-drop");
          }
        });
        s.addEventListener("dragleave", () => s.classList.remove("sct-drop"));
        s.addEventListener("drop", (e) => {
          e.preventDefault();
          const from = dragSlotId;
          dragSlotId = null;
          s.classList.remove("sct-drop");
          if (from && from !== slot.id) swapSlots(from, slot.id);
        });
      }
      grid.append(s);
    });
    wrap.append(grid);
    frag.append(wrap);
  }
  box.replaceChildren(frag);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && planSel) cancelPlacing();
});
