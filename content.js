// ---- Optional: automatic tags based on the course number prefix ----
// Course numbers look like "2.01.8901". Adjust/extend this map to your needs.
const PREFIX_TAGS = {
  "2.01": "Informatik",
  // "2.02": "Physik",
  // "1.05": "Wirtschaft",
};

const PALETTE = [
  "#cfe3f8", "#d6f0d2", "#fde3c1", "#f6d0e0", "#e2d6f5",
  "#fff3b0", "#c9f0ee", "#f8d4cf", "#dfe7c4", "#d9d9e8",
];

const state = {
  tags: {},          // { courseId: ["tag", ...] }
  colors: {},        // { tagName: "#rrggbb" }
  active: new Set(), // tags selected in the filter bar
  mode: "any",       // "any" (OR) or "all" (AND)
  plan: {},          // { slotId: { id, number, name } } – Studienablaufplan
  planOpen: true,    // plan expanded?
  meta: {},          // { courseId: { number, name } } remembered from "My courses" (used on other pages)
  planerFilter: { tags: [], mode: "any", planOnly: false, sems: [] }, // Planer (timetable) filter
  planLayout: {},    // { slotId: { sem, col } } – blocks the user swapped in the Studienablaufplan
  planAlias: {},     // { defaultPlanTagName: renamedTagName } so the plan follows tag renames
};

// ---------- storage ----------
// After the extension is reloaded/updated, old content scripts in open tabs lose
// their connection ("Extension context invalidated"). Detect that and shut down quietly.
let observer = null;
function alive() {
  try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
}
function shutdown() {
  observer?.disconnect();
  clearTimeout(timer);
  closePopover();
  document.getElementById("sct-bar")?.remove();
  document.getElementById("sct-plan")?.remove();
  document.getElementById("sct-pbar")?.remove();
  document.querySelectorAll(".sct-ev-tags").forEach((n) => n.remove());
  document.querySelectorAll("section.uol-fc .fc-event").forEach((n) => { n.style.display = ""; delete n.dataset.sctSig; });
  document.querySelectorAll(".sct-wrap").forEach((w) => w.remove());
  rows().forEach((r) => { r.style.display = ""; });
  console.info("[Stud.IP Course Tags] extension was reloaded – refresh this page to re-enable it.");
}
async function storageGet(keys) {
  if (!alive()) { shutdown(); return {}; }
  try { return await chrome.storage.local.get(keys); }
  catch (e) { shutdown(); return {}; }
}
async function storageSet(obj) {
  if (!alive()) { shutdown(); return; }
  try { await chrome.storage.local.set(obj); }
  catch (e) { shutdown(); }
}

async function loadState() {
  const r = await storageGet(["courseTags", "tagColors", "studyPlan", "planOpen", "planAlias", "courseMeta", "planerFilter", "planLayout"]);
  state.tags = r.courseTags || state.tags;
  state.colors = r.tagColors || state.colors;
  state.plan = r.studyPlan || state.plan;
  state.planAlias = r.planAlias || state.planAlias;
  state.meta = r.courseMeta || state.meta;
  state.planLayout = r.planLayout || state.planLayout;
  state.planerFilter = { ...state.planerFilter, ...(r.planerFilter || {}) };
  if (typeof r.planOpen === "boolean") state.planOpen = r.planOpen;
}
const saveTags = () => storageSet({ courseTags: state.tags });
const saveColors = () => storageSet({ tagColors: state.colors });

// ---------- colours ----------
function colorFor(tag) {
  if (state.colors[tag]) return state.colors[tag];
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function textColorFor(bg) {
  const n = parseInt(bg.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#1e2733" : "#ffffff";
}
function paint(el, tag) {
  const bg = colorFor(tag);
  el.style.background = bg;
  el.style.color = textColorFor(bg);
}

// ---------- row helpers ----------
const rows = () => [...document.querySelectorAll("table.mycourses tbody tr[data-course-id]")];

function autoTagsForNumber(num) {
  num = (num || "").trim();
  return Object.entries(PREFIX_TAGS).filter(([p]) => num.startsWith(p)).map(([, l]) => l);
}
function autoTags(row) {
  return autoTagsForNumber(row.querySelector("td:nth-child(3)")?.textContent);
}

// Remember number + name of every course seen on "My courses" so other pages (Planer) can derive auto tags
function syncMeta() {
  let changed = false;
  rows().forEach((r) => {
    const i = courseInfo(r);
    const cur = state.meta[i.id];
    if (!cur || cur.number !== i.number || cur.name !== i.name) {
      state.meta[i.id] = { number: i.number, name: i.name };
      changed = true;
    }
  });
  if (changed) storageSet({ courseMeta: state.meta });
}
function manualTags(row) {
  return state.tags[row.dataset.courseId] || [];
}
function allTags(row) {
  return [...new Set([...autoTags(row), ...manualTags(row)])];
}

// ---------- colour popover (own UI, no hidden native picker) ----------
const SWATCHES = [
  ...PALETTE,
  "#4f8fdc", "#3fa65b", "#e8913a", "#d9558f", "#8a63d2",
  "#e0c200", "#2fb5ad", "#d9534f", "#7f9a3a", "#5f6585",
];

function closePopover() {
  document.getElementById("sct-pop")?.remove();
  document.removeEventListener("mousedown", onOutside, true);
  document.removeEventListener("keydown", onEsc, true);
}
function onOutside(e) {
  const pop = document.getElementById("sct-pop");
  if (pop && !pop.contains(e.target)) closePopover();
}
function onEsc(e) { if (e.key === "Escape") closePopover(); }

async function setColor(tag, color) {
  if (color) state.colors[tag] = color; else delete state.colors[tag];
  await saveColors();
  closePopover();
  lastBarSig = "";
  refreshAll();
}

async function renameTag(oldTag, input) {
  const wanted = input.trim();
  if (!wanted || wanted === oldTag) { closePopover(); return; }

  // Is there already a different tag with that name (ignoring case)? -> merge into its spelling
  const existing = new Set(Object.values(state.tags).flat());
  rows().forEach((r) => allTags(r).forEach((t) => existing.add(t)));
  let target = wanted;
  let merging = false;
  if (norm(wanted) !== norm(oldTag)) {
    const clash = [...existing].find((t) => t !== oldTag && norm(t) === norm(wanted));
    if (clash) {
      if (!confirm(`A tag “${clash}” already exists.\nMerge “${oldTag}” into it?`)) return;
      target = clash;
      merging = true;
    }
  }

  const oldColor = colorFor(oldTag);
  for (const id of Object.keys(state.tags)) {
    const list = state.tags[id].map((t) => (t === oldTag ? target : t));
    state.tags[id] = [...new Set(list)];
  }
  // keep the look of the tag (colours are otherwise derived from the name)
  if (!merging && !state.colors[target]) state.colors[target] = oldColor;
  delete state.colors[oldTag];

  if (state.active.has(oldTag)) { state.active.delete(oldTag); state.active.add(target); }

  // let the Studienablaufplan follow the rename
  Object.values(PLAN_TAG).forEach((base) => {
    if (norm(planTagName(base)) === norm(oldTag)) {
      if (target === base) delete state.planAlias[base]; else state.planAlias[base] = target;
    }
  });

  await storageSet({ courseTags: state.tags, tagColors: state.colors, planAlias: state.planAlias });
  closePopover();
  lastBarSig = "";
  lastPlanSig = "";
  refreshAll();
}

function openColorPopover(tag, anchor, manual) {
  closePopover();
  const pop = document.createElement("div");
  pop.id = "sct-pop";

  const title = document.createElement("div");
  title.className = "sct-pop-title";
  title.textContent = `Tag “${tag}”`;
  pop.append(title);

  if (manual) {
    const rn = document.createElement("div");
    rn.className = "sct-pop-row sct-rename";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "sct-rename-input";
    inp.value = tag;
    inp.maxLength = 60;
    const go = document.createElement("button");
    go.className = "sct-mode";
    go.textContent = "rename";
    go.title = "Renames this tag on every course (renaming to an existing tag merges them)";
    go.addEventListener("click", (e) => { e.preventDefault(); renameTag(tag, inp.value); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); renameTag(tag, inp.value); } });
    rn.append(inp, go);
    pop.append(rn);
  } else {
    const note = document.createElement("div");
    note.className = "sct-hint";
    note.textContent = "Automatic tag (from the course number). Rename it via PREFIX_TAGS in content.js.";
    note.style.marginBottom = "8px";
    pop.append(note);
  }

  const grid = document.createElement("div");
  grid.className = "sct-swatches";
  SWATCHES.forEach((c) => {
    const b = document.createElement("button");
    b.className = "sct-swatch";
    b.style.background = c;
    b.title = c;
    b.addEventListener("click", (e) => { e.preventDefault(); setColor(tag, c); });
    grid.append(b);
  });
  pop.append(grid);

  const row = document.createElement("div");
  row.className = "sct-pop-row";
  const custom = document.createElement("input");
  custom.type = "color";
  custom.value = colorFor(tag);
  custom.addEventListener("change", () => setColor(tag, custom.value));
  const customLbl = document.createElement("span");
  customLbl.textContent = "custom";
  const reset = document.createElement("button");
  reset.className = "sct-mode";
  reset.textContent = "reset";
  reset.addEventListener("click", (e) => { e.preventDefault(); setColor(tag, null); });
  row.append(custom, customLbl, reset);
  pop.append(row);

  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${window.scrollY + r.bottom + 4}px`;
  pop.style.left = `${Math.max(4, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8))}px`;
  setTimeout(() => {
    document.addEventListener("mousedown", onOutside, true);
    document.addEventListener("keydown", onEsc, true);
  }, 0);
}

// ---------- export / import ----------
const HEX = /^#[0-9a-f]{6}$/i;

function exportData() {
  const courses = {};
  const known = new Map(rows().map((r) => [r.dataset.courseId, r]));
  for (const [id, tags] of Object.entries(state.tags)) {
    const row = known.get(id);
    courses[id] = {
      number: row?.querySelector("td:nth-child(3)")?.textContent.trim() || undefined,
      name: row?.querySelector("td:nth-child(4) a")?.textContent.trim() || undefined,
      tags,
    };
  }
  const payload = { app: "studip-course-tags", version: 2, exportedAt: new Date().toISOString(), colors: state.colors, courses, plan: state.plan, planAlias: state.planAlias, layout: state.planLayout };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `studip-tags-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importFile(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== "studip-course-tags" || typeof data.courses !== "object") {
      throw new Error("This doesn't look like a Stud.IP Course Tags export.");
    }
    let courseCount = 0, tagCount = 0;
    for (const [id, c] of Object.entries(data.courses)) {
      if (!/^[0-9a-f]{32}$/i.test(id) || !Array.isArray(c?.tags)) continue;
      const cur = new Set(state.tags[id] || []);
      const before = cur.size;
      c.tags.filter((t) => typeof t === "string" && t.trim()).forEach((t) => cur.add(t.trim()));
      if (cur.size) state.tags[id] = [...cur];
      if (cur.size > before) { courseCount++; tagCount += cur.size - before; }
    }
    let colorCount = 0;
    for (const [t, col] of Object.entries(data.colors || {})) {
      if (typeof col === "string" && HEX.test(col)) { state.colors[t] = col.toLowerCase(); colorCount++; }
    }
    // Block layout: only accepted if it is a valid permutation of the swappable blocks' positions
    let layoutApplied = false;
    const swappable = PLAN_SLOTS.filter(isSwappable);
    const lay = data.layout;
    if (lay && typeof lay === "object") {
      const key = (q) => `${q.sem}-${q.col}`;
      const given = swappable.map((sl) => lay[sl.id]);
      if (given.every((q) => q && Number.isInteger(q.sem) && Number.isInteger(q.col)) &&
          given.map(key).sort().join() === swappable.map(key).sort().join()) {
        state.planLayout = {};
        swappable.forEach((sl) => {
          const q = lay[sl.id];
          if (q.sem !== sl.sem || q.col !== sl.col) state.planLayout[sl.id] = { sem: q.sem, col: q.col };
        });
        layoutApplied = true;
      }
    }
    let planCount = 0;
    for (const slot of PLAN_SLOTS) {
      const p = data.plan?.[slot.id];
      if (p && typeof p.name === "string" && p.name.trim()) {
        state.plan[slot.id] = {
          id: typeof p.id === "string" && /^[0-9a-f]{32}$/i.test(p.id) ? p.id : null,
          number: typeof p.number === "string" ? p.number : "",
          name: p.name.trim(),
        };
        planCount++;
      }
    }
    for (const [base, name] of Object.entries(data.planAlias || {})) {
      if (Object.values(PLAN_TAG).includes(base) && typeof name === "string" && name.trim()) state.planAlias[base] = name.trim();
    }
    await Promise.all([saveTags(), saveColors(), planStore(), storageSet({ planAlias: state.planAlias, planLayout: state.planLayout })]);
    lastBarSig = "";
    refreshAll();
    alert(`Import finished (merged with existing data).\n${tagCount} new tag assignment(s) on ${courseCount} course(s), ${colorCount} colour(s) applied, ${planCount} plan slot(s) filled.${layoutApplied ? " Plan layout restored." : ""}`);
  } catch (err) {
    alert("Import failed: " + err.message);
  }
}

// ---------- tags next to the course name ----------
function makeTag(tag, removable, courseId) {
  const el = document.createElement("span");
  el.className = "sct-tag";
  el.title = "Click to change colour" + (removable ? " · × to remove" : "");
  paint(el, tag);

  const label = document.createElement("span");
  label.textContent = tag;
  label.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openColorPopover(tag, el, removable);
  });
  el.append(label);

  if (removable) {
    const x = document.createElement("span");
    x.className = "sct-x";
    x.textContent = "×";
    x.addEventListener("click", async (e) => {
      e.preventDefault();
      state.tags[courseId] = state.tags[courseId].filter((t) => t !== tag);
      if (!state.tags[courseId].length) delete state.tags[courseId];
      await saveTags();
      refreshAll();
    });
    el.append(x);
  }
  return el;
}

function renderRow(row) {
  const nameCell = row.querySelector("td:nth-child(4)");
  if (!nameCell) return;
  let wrap = row.querySelector(".sct-wrap");
  if (!wrap) {
    wrap = document.createElement("span");
    wrap.className = "sct-wrap";
    const link = nameCell.querySelector("a");
    if (!link) return;
    link.after(wrap);
  }
  const id = row.dataset.courseId;
  const frag = document.createDocumentFragment();
  autoTags(row).forEach((t) => frag.append(makeTag(t, false, id)));
  manualTags(row).forEach((t) => frag.append(makeTag(t, true, id)));

  const add = document.createElement("button");
  add.className = "sct-add";
  add.textContent = "+ tag";
  add.addEventListener("click", async (e) => {
    e.preventDefault();
    const input = prompt("Tag name(s), comma-separated.\nTags used by the plan: " + Object.values(PLAN_TAG).map(planTagName).join(", "));
    if (!input) return;
    const list = input.split(",").map((s) => s.trim()).filter(Boolean);
    const cur = new Set(state.tags[id] || []);
    list.forEach((t) => cur.add(t));
    if (cur.size) state.tags[id] = [...cur];
    await saveTags();
    refreshAll();
  });
  frag.append(add, makePlanButton(row));
  wrap.replaceChildren(frag);
}

// ---------- filter bar ----------
function ensureBar() {
  const firstTable = document.querySelector("table.mycourses");
  if (!firstTable) return null;
  let bar = document.getElementById("sct-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "sct-bar";
    firstTable.parentElement.insertBefore(bar, firstTable);
  } else if (!bar.isConnected) {
    firstTable.parentElement.insertBefore(bar, firstTable);
  }
  return bar;
}

let lastBarSig = "";
function renderBar() {
  const bar = ensureBar();
  if (!bar) return;
  const rs = rows();
  const tags = [...new Set(rs.flatMap(allTags))].sort((a, b) => a.localeCompare(b));
  state.active.forEach((t) => { if (!tags.includes(t)) state.active.delete(t); });

  const sig = JSON.stringify([tags, tags.map(colorFor), [...state.active], state.mode, bar.isConnected]);
  if (sig === lastBarSig && bar.childElementCount) return; // avoid pointless DOM churn
  lastBarSig = sig;

  const frag = document.createDocumentFragment();
  const title = document.createElement("strong");
  title.textContent = "Filter by tag: ";
  frag.append(title);

  if (!tags.length) {
    const hint = document.createElement("span");
    hint.className = "sct-hint";
    hint.textContent = "no tags yet – use “+ tag” next to a course";
    frag.append(hint);
  }
  tags.forEach((t) => {
    const chip = document.createElement("button");
    chip.className = "sct-chip" + (state.active.has(t) ? " sct-on" : "");
    chip.textContent = t;
    paint(chip, t);
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      state.active.has(t) ? state.active.delete(t) : state.active.add(t);
      refreshAll();
    });
    frag.append(chip);
  });

  const mode = document.createElement("button");
  mode.className = "sct-mode";
  mode.textContent = state.mode === "any" ? "match: ANY" : "match: ALL";
  mode.title = "ANY = course has at least one selected tag · ALL = course has every selected tag";
  mode.addEventListener("click", (e) => {
    e.preventDefault();
    state.mode = state.mode === "any" ? "all" : "any";
    refreshAll();
  });
  frag.append(mode);

  const clear = document.createElement("button");
  clear.className = "sct-mode";
  clear.textContent = "clear";
  clear.addEventListener("click", (e) => {
    e.preventDefault();
    state.active.clear();
    refreshAll();
  });
  frag.append(clear);

  const exp = document.createElement("button");
  exp.className = "sct-mode sct-right";
  exp.textContent = "export";
  exp.title = "Download all tags and colours as a JSON file";
  exp.addEventListener("click", (e) => { e.preventDefault(); exportData(); });
  frag.append(exp);

  const imp = document.createElement("button");
  imp.className = "sct-mode";
  imp.textContent = "import";
  imp.title = "Load a previously exported JSON file (merged with your current tags)";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) importFile(fileInput.files[0]);
    fileInput.value = "";
  });
  imp.addEventListener("click", (e) => { e.preventDefault(); fileInput.click(); });
  frag.append(imp, fileInput);

  const count = document.createElement("span");
  count.id = "sct-count";
  count.className = "sct-hint";
  frag.append(count);

  bar.replaceChildren(frag);
}

function applyFilter() {
  const rs = rows();
  const sel = [...state.active];
  let shown = 0;
  rs.forEach((row) => {
    let ok = true;
    if (sel.length) {
      const t = allTags(row);
      ok = state.mode === "any" ? sel.some((s) => t.includes(s)) : sel.every((s) => t.includes(s));
    }
    row.style.display = ok ? "" : "none";
    if (ok) shown++;
  });
  const c = document.getElementById("sct-count");
  if (c) c.textContent = sel.length ? ` ${shown} / ${rs.length} courses shown` : "";
}

// ---------- orchestration ----------
function refreshAll() {
  syncMeta();
  rows().forEach(renderRow);
  renderBar();
  renderPlan();
  renderPlaner();
  applyFilter();
}

// Cheap pass for Vue re-renders: only touch rows that lost their tags.
function onDomChange() {
  let dirty = false;
  rows().forEach((row) => {
    if (!row.querySelector(".sct-wrap")) { renderRow(row); dirty = true; }
  });
  syncMeta();
  renderBar();
  renderPlan();
  renderPlaner();
  if (dirty || state.active.size) applyFilter();
}

let timer;
observer = new MutationObserver(() => {
  if (!alive()) { shutdown(); return; }
  clearTimeout(timer);
  timer = setTimeout(onDomChange, 150);
});
observer.observe(document.body, { childList: true, subtree: true });

// Keep multiple tabs in sync
try {
  chrome.storage.onChanged.addListener(async () => {
    if (!alive()) { shutdown(); return; }
    await loadState();
    refreshAll();
  });
} catch (e) { /* context already invalid */ }

loadState().then(() => { if (alive()) refreshAll(); });
