// ============================================================================
// Planer (timetable) integration – loaded after plan.js, before content.js.
// Shows tags / plan markers on the calendar events and adds a filter bar.
// Uses globals from plan.js and content.js (state, colorFor, paint, norm, el,
// placedSlotOf, PLAN_SLOTS, storageSet, ...) at runtime only.
// ============================================================================

const PLANER_DEFAULT_FILTER = { tags: [], mode: "any", planOnly: false, sems: [] };
let lastPBarSig = "";

const planerRoot = () => document.querySelector("section.uol-fc");

function planerEvents() {
  const root = planerRoot();
  if (!root) return [];
  return [...root.querySelectorAll(".fc-event")].filter(
    (ev) => !ev.classList.contains("fc-mirror") && !ev.classList.contains("fc-helper")
  );
}
function eventCourseId(ev) {
  const a = ev.querySelector('a[href*="cid="]');
  const m = a && a.href.match(/[?&]cid=([0-9a-f]{32})/i);
  return m ? m[1] : null;
}
// Course name: remembered from "My courses", else read from the event title (without our own chips)
function eventCourseName(ev, id) {
  if (id && state.meta[id]?.name) return state.meta[id].name;
  const t = ev.querySelector(".fc-title");
  if (!t) return "";
  const clone = t.cloneNode(true);
  clone.querySelector(".sct-ev-tags")?.remove();
  return clone.textContent.trim();
}
// Tags of a course known only by its ID (auto tags come from the course number saved on "My courses")
function tagsById(id) {
  const auto = autoTagsForNumber(state.meta[id]?.number || "");
  return [...new Set([...auto, ...(state.tags[id] || [])])];
}
function slotSems(slot) {
  return Array.from({ length: slot.rs }, (_, i) => slotSem(slot) + i);
}

// ---------- tags + plan marker on each event ----------
function decorateEvent(ev) {
  const id = eventCourseId(ev);
  const tags = id ? tagsById(id) : [];
  const hit = id ? planSlotFor(id, eventCourseName(ev, id), tags) : null;
  const slot = hit && hit.slot;
  const sig = JSON.stringify([tags, tags.map(colorFor), slot && slot.id, slot && slotSem(slot), hit && hit.grouped]);
  if (ev.dataset.sctSig === sig && ev.querySelector(".sct-ev-tags")) return;
  ev.dataset.sctSig = sig;

  ev.querySelector(".sct-ev-tags")?.remove();
  if (!tags.length && !slot) return;
  const host = ev.querySelector(".fc-title") || ev.querySelector(".fc-content");
  if (!host) return;

  const wrap = el("span", "sct-ev-tags");
  if (slot) {
    const p = el("span", "sct-ev-tag sct-ev-plan", `▦ ${slotSem(slot)}. Sem`);
    p.title = hit.grouped ? `Übung of a planned course: ${slot.label}` : `In plan: ${slot.label}`;
    wrap.append(p);
  }
  tags.forEach((t) => {
    const c = el("span", "sct-ev-tag", t);
    paint(c, t);
    wrap.append(c);
  });
  host.append(wrap);
}

// ---------- filter logic ----------
function planerMatches(id, name) {
  const f = state.planerFilter;
  if (!f.tags.length && !f.planOnly) return true;
  if (!id) return false; // events that aren't courses (private dates) are hidden while filtering
  if (f.planOnly) {
    const hit = planSlotFor(id, name, tagsById(id));
    if (!hit) return false;
    const slot = hit.slot;
    if (f.sems.length && !slotSems(slot).some((s) => f.sems.includes(s))) return false;
  }
  if (f.tags.length) {
    const have = new Set(tagsById(id).map(norm));
    const want = f.tags.map(norm);
    const ok = f.mode === "any" ? want.some((t) => have.has(t)) : want.every((t) => have.has(t));
    if (!ok) return false;
  }
  return true;
}

function applyPlanerFilter(evs) {
  const f = state.planerFilter;
  let shown = 0;
  evs.forEach((ev) => {
    const id = eventCourseId(ev);
    const ok = planerMatches(id, id ? eventCourseName(ev, id) : "");
    ev.style.display = ok ? "" : "none";
    if (ok) shown++;
  });
  const c = document.getElementById("sct-pcount");
  if (c) {
    const active = f.tags.length || f.planOnly;
    c.textContent = active ? ` ${shown} / ${evs.length} events shown this week` : "";
  }
}

function setPlanerFilter(patch) {
  state.planerFilter = { ...state.planerFilter, ...patch };
  storageSet({ planerFilter: state.planerFilter });
  lastPBarSig = "";
  renderPlaner();
}
function toggleIn(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// ---------- filter bar above the calendar ----------
function renderPlanerBar(root, evs) {
  let bar = document.getElementById("sct-pbar");
  if (!bar) { bar = document.createElement("div"); bar.id = "sct-pbar"; bar.className = "sct-bar-base"; }
  if (!bar.isConnected || bar.nextElementSibling !== root) root.parentElement.insertBefore(bar, root);

  const f = state.planerFilter;
  const onPage = new Set(evs.flatMap((ev) => { const id = eventCourseId(ev); return id ? tagsById(id) : []; }));
  const tags = [...new Set([...onPage, ...f.tags])].sort((a, b) => a.localeCompare(b));
  const planEmpty = !Object.keys(state.plan).length;

  const sig = JSON.stringify([tags, tags.map(colorFor), f, planEmpty]);
  if (sig === lastPBarSig && bar.childElementCount) return;
  lastPBarSig = sig;

  const frag = document.createDocumentFragment();
  frag.append(el("strong", null, "Tags: "));
  if (!tags.length) frag.append(el("span", "sct-hint", "no tags on this week's courses"));
  tags.forEach((t) => {
    const chip = el("button", "sct-chip" + (f.tags.includes(t) ? " sct-on" : ""), t);
    paint(chip, t);
    chip.addEventListener("click", (e) => { e.preventDefault(); setPlanerFilter({ tags: toggleIn(f.tags, t) }); });
    frag.append(chip);
  });

  const mode = el("button", "sct-mode", f.mode === "any" ? "match: ANY" : "match: ALL");
  mode.title = "ANY = at least one selected tag · ALL = every selected tag";
  mode.addEventListener("click", (e) => { e.preventDefault(); setPlanerFilter({ mode: f.mode === "any" ? "all" : "any" }); });
  frag.append(mode);

  frag.append(el("span", "sct-sep"));

  const plan = el("button", "sct-chip sct-plan-chip" + (f.planOnly ? " sct-on" : ""), "▦ Only my plan");
  plan.title = "Show only courses you placed in the Studienablaufplan";
  plan.addEventListener("click", (e) => { e.preventDefault(); setPlanerFilter({ planOnly: !f.planOnly }); });
  frag.append(plan);

  if (f.planOnly) {
    for (let s = 1; s <= 4; s++) {
      const b = el("button", "sct-chip sct-plan-chip" + (f.sems.includes(s) ? " sct-on" : ""), `${s}. Sem`);
      b.title = "Limit to courses planned for this semester (none selected = all)";
      b.addEventListener("click", (e) => { e.preventDefault(); setPlanerFilter({ sems: toggleIn(f.sems, s) }); });
      frag.append(b);
    }
    if (planEmpty) frag.append(el("span", "sct-hint sct-warn", "Your plan is empty."));
  }

  const clear = el("button", "sct-mode", "clear");
  clear.addEventListener("click", (e) => { e.preventDefault(); setPlanerFilter({ ...PLANER_DEFAULT_FILTER }); });
  frag.append(clear);

  const count = el("span", "sct-hint");
  count.id = "sct-pcount";
  frag.append(count);

  bar.replaceChildren(frag);
}

// ---------- entry point (called from content.js) ----------
function renderPlaner() {
  const root = planerRoot();
  if (!root) return;
  const evs = planerEvents();
  evs.forEach(decorateEvent);
  renderPlanerBar(root, evs);
  applyPlanerFilter(evs);
}
