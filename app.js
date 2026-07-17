// ---------- Setup ----------
const CUISINES = ["Chinese", "Japanese", "Korean", "Thai", "Italian", "Western", "Other"];
const CUISINE_COLORS = {
  Chinese: "#FF6B6A", Japanese: "#3DCCC7", Korean: "#8B7FE8",
  Thai: "#5FBF6B", Italian: "#FF8E53", Western: "#4A9FE0", Other: "#B0A69A",
};
const STALE_DAYS = 30;

// Starts empty — recipes come from the Google Sheet once config.js is connected,
// or from whatever you add in the Cookbook tab.
let recipes = [];

let state = {
  tab: "cookbook",
  cookbookSearch: "", cookbookCuisine: "All",
  weekSearch: "", weekCuisine: "All",
  editingId: null,
  expandedId: null,
  selectedWeek: new Set(),
  extraIngredients: [],
  removedItems: new Set(),
  checkedItems: new Set(),
};

// ---------- Data layer (Google Sheet via Apps Script) ----------
async function loadRecipes() {
  if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) {
    setSyncStatus("Connect the Google Sheet in config.js to start saving recipes");
    return;
  }
  setSyncStatus("Loading our recipes...");
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    recipes = data.map(r => ({
      ...r,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : String(r.ingredients || "").split(";").map(s => s.trim()).filter(Boolean)
    }));
    setSyncStatus("");
    renderAll();
  } catch (err) {
    setSyncStatus("Could not reach the Google Sheet — showing sample data");
  }
}

async function saveRecipeToSheet(recipe) {
  if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) return;
  setSyncStatus("Saving...");
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight with Apps Script
      body: JSON.stringify(recipe),
    });
    setSyncStatus("Saved");
    setTimeout(() => setSyncStatus(""), 1500);
  } catch (err) {
    setSyncStatus("Could not save to the Google Sheet, check the connection");
  }
}

function setSyncStatus(msg) {
  document.getElementById("syncStatus").textContent = msg;
}

// ---------- Helpers ----------
function daysSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// "chicken rice" -> "Chicken Rice"
function toTitleCase(str) {
  return str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// "BACON" or "bacon" -> "Bacon", "chicken thigh" -> "Chicken thigh"
function toSentenceCase(str) {
  const s = str.trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Splits a block of recipe text into individual sentences/steps
function splitIntoSentences(text) {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function renderChips(containerId, selected, onPick) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  ["All", ...CUISINES].forEach(c => {
    const btn = document.createElement("button");
    btn.className = "chip" + (selected === c ? " active" : "");
    btn.textContent = c;
    btn.onclick = () => onPick(c);
    el.appendChild(btn);
  });
}

// ---------- Cookbook tab ----------
function renderCookbook() {
  renderChips("cookbookCuisineChips", state.cookbookCuisine, (c) => { state.cookbookCuisine = c; renderCookbook(); });

  const q = state.cookbookSearch.toLowerCase().trim();
  const filtered = recipes.filter(r => {
    const matchCuisine = state.cookbookCuisine === "All" || r.cuisine === state.cookbookCuisine;
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.ingredients.some(i => i.toLowerCase().includes(q));
    return matchCuisine && matchSearch;
  });

  const list = document.getElementById("recipeList");
  const empty = document.getElementById("cookbookEmpty");
  list.innerHTML = "";
  empty.style.display = filtered.length === 0 ? "block" : "none";

  filtered.forEach((r, idx) => {
    const stale = daysSince(r.lastCooked) > STALE_DAYS;
    const tiltClass = idx % 2 === 0 ? "tilt-l" : "tilt-r";
    const tapeRotClass = idx % 2 === 0 ? "rot-l" : "rot-r";
    const expanded = state.expandedId === r.id;

    const card = document.createElement("div");
    card.className = "recipe-card " + tiltClass;

    const ingredientPills = r.ingredients.map(i => `<span class="ingredient-pill">${escapeHtml(i)}</span>`).join("");
    const recipeLines = String(r.recipeText || "").split("\n").filter(Boolean)
      .map(line => `<p class="recipe-line">${escapeHtml(line)}</p>`).join("");
    const notesHtml = r.notes ? `<div class="notes-box"><span>📝 ${escapeHtml(r.notes)}</span></div>` : "";

    card.innerHTML = `
      <div class="tape ${tapeRotClass}" style="background:${CUISINE_COLORS[r.cuisine] || CUISINE_COLORS.Other}"></div>
      <div class="card-top">
        <div class="card-top-text">
          <div class="card-name">${escapeHtml(r.name)}</div>
          <span class="badge" style="background:${CUISINE_COLORS[r.cuisine] || CUISINE_COLORS.Other}">${escapeHtml(r.cuisine)}</span>
          ${stale ? `<span class="stale-badge">⏱ haven't made this in a while</span>` : ""}
        </div>
        <button class="edit-btn">Edit</button>
      </div>
      ${expanded ? `
      <div class="card-detail">
        <div class="detail-label">Ingredients</div>
        <div>${ingredientPills}</div>
        <div class="detail-label" style="margin-top:6px;">Recipe</div>
        <div class="recipe-steps">${recipeLines}</div>
        ${notesHtml}
      </div>` : ""}
    `;

    card.querySelector(".card-top-text").onclick = () => { state.expandedId = expanded ? null : r.id; renderCookbook(); };
    card.querySelector(".edit-btn").onclick = () => openForm(r);
    list.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

// ---------- Add/Edit form ----------
function openForm(recipe) {
  document.getElementById("formModal").style.display = "flex";
  const cuisineSelect = document.getElementById("formCuisine");
  cuisineSelect.innerHTML = CUISINES.map(c => `<option value="${c}">${c}</option>`).join("");

  if (recipe) {
    state.editingId = recipe.id;
    document.getElementById("modalTitle").textContent = "Edit recipe";
    document.getElementById("formName").value = recipe.name;
    cuisineSelect.value = recipe.cuisine;
    document.getElementById("formRecipeText").value = recipe.recipeText;
    document.getElementById("formIngredients").value = recipe.ingredients.join(", ");
    document.getElementById("formNotes").value = recipe.notes || "";
  } else {
    state.editingId = null;
    document.getElementById("modalTitle").textContent = "New recipe";
    document.getElementById("formName").value = "";
    cuisineSelect.value = "Chinese";
    document.getElementById("formRecipeText").value = "";
    document.getElementById("formIngredients").value = "";
    document.getElementById("formNotes").value = "";
  }
}

function closeForm() {
  document.getElementById("formModal").style.display = "none";
  state.editingId = null;
}

async function saveRecipe() {
  const rawName = document.getElementById("formName").value.trim();
  if (!rawName) return;
  const name = toTitleCase(rawName);
  const cuisine = document.getElementById("formCuisine").value;
  const rawRecipeText = document.getElementById("formRecipeText").value.trim();
  const recipeText = splitIntoSentences(rawRecipeText).map(toSentenceCase).join("\n");
  const ingredients = document.getElementById("formIngredients").value.split(",").map(s => s.trim()).filter(Boolean).map(toSentenceCase);
  const notes = document.getElementById("formNotes").value.trim();

  // Logging a recipe with the same name overrides the existing one (latest version wins)
  const existingByName = recipes.find(r => r.name.trim().toLowerCase() === name.toLowerCase() && r.id !== state.editingId);

  let recipeObj;
  if (state.editingId) {
    recipeObj = recipes.find(r => r.id === state.editingId);
    Object.assign(recipeObj, { name, cuisine, recipeText, ingredients, notes });
  } else if (existingByName) {
    Object.assign(existingByName, { cuisine, recipeText, ingredients, notes, lastCooked: todayStr() });
    recipeObj = existingByName;
  } else {
    recipeObj = { id: String(Date.now()), name, cuisine, recipeText, ingredients, notes, lastCooked: todayStr() };
    recipes.push(recipeObj);
  }

  closeForm();
  renderAll();
  await saveRecipeToSheet(recipeObj);
}

// ---------- Spoonprise Us tab ----------
let randomCuisine = "All";
let randomExpanded = false;
function renderRandomTab() {
  renderChips("randomCuisineChips", randomCuisine, (c) => { randomCuisine = c; renderRandomTab(); });
}

function rollRandom() {
  const pool = randomCuisine === "All" ? recipes : recipes.filter(r => r.cuisine === randomCuisine);
  const resultEl = document.getElementById("randomResult");
  if (pool.length === 0) {
    resultEl.innerHTML = `<div class="empty-state">No recipes logged for this cuisine yet.</div>`;
    return;
  }
  randomExpanded = false;
  resultEl.innerHTML = `<div class="spinning-text">the spoon has spoken. 🥄</div>`;
  setTimeout(() => {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    renderRandomResult(pick);
  }, 500);
}

function renderRandomResult(pick) {
  const resultEl = document.getElementById("randomResult");
  const ingredientPills = pick.ingredients.map(i => `<span class="ingredient-pill">${escapeHtml(i)}</span>`).join("");
  const recipeLines = String(pick.recipeText || "").split("\n").filter(Boolean)
    .map(line => `<p class="recipe-line">${escapeHtml(line)}</p>`).join("");
  const notesHtml = pick.notes ? `<div class="notes-box"><span>📝 ${escapeHtml(pick.notes)}</span></div>` : "";

  resultEl.innerHTML = `
    <div class="result-card" style="cursor:pointer;">
      <div class="result-name">${escapeHtml(pick.name)}</div>
      <span class="badge" style="background:${CUISINE_COLORS[pick.cuisine] || CUISINE_COLORS.Other}">${escapeHtml(pick.cuisine)}</span>
      ${randomExpanded ? `
        <div class="card-detail" style="text-align:left; margin-top:14px;">
          <div class="detail-label">Ingredients</div>
          <div>${ingredientPills}</div>
          <div class="detail-label" style="margin-top:6px;">Recipe</div>
          <div class="recipe-steps">${recipeLines}</div>
          ${notesHtml}
        </div>` : `<div class="tap-hint">tap to see the ingredients</div>`}
    </div>`;

  resultEl.querySelector(".result-card").onclick = () => { randomExpanded = !randomExpanded; renderRandomResult(pick); };
}

// ---------- This Week tab ----------
function renderWeekTab() {
  renderChips("weekCuisineChips", state.weekCuisine, (c) => { state.weekCuisine = c; renderWeekTab(); });

  const q = state.weekSearch.toLowerCase().trim();
  const filtered = recipes.filter(r => {
    const matchCuisine = state.weekCuisine === "All" || r.cuisine === state.weekCuisine;
    const matchSearch = !q || r.name.toLowerCase().includes(q);
    return matchCuisine && matchSearch;
  });

  const list = document.getElementById("weekRecipeList");
  list.innerHTML = "";
  filtered.forEach(r => {
    const row = document.createElement("label");
    row.className = "week-item";
    row.innerHTML = `
      <input type="checkbox" ${state.selectedWeek.has(r.id) ? "checked" : ""} />
      <div class="name">${escapeHtml(r.name)}</div>
      <span class="badge" style="background:${CUISINE_COLORS[r.cuisine] || CUISINE_COLORS.Other}">${escapeHtml(r.cuisine)}</span>
    `;
    row.querySelector("input").onchange = () => {
      state.selectedWeek.has(r.id) ? state.selectedWeek.delete(r.id) : state.selectedWeek.add(r.id);
      renderShoppingList();
    };
    list.appendChild(row);
  });

  renderShoppingList();
}

function getShoppingList() {
  const set = new Set();
  recipes.forEach(r => { if (state.selectedWeek.has(r.id)) r.ingredients.forEach(i => set.add(i)); });
  state.extraIngredients.forEach(i => set.add(i));
  state.removedItems.forEach(i => set.delete(i));
  return Array.from(set);
}

function renderShoppingList() {
  const list = getShoppingList();
  const card = document.getElementById("shoppingListCard");
  const empty = document.getElementById("weekEmpty");
  card.style.display = list.length ? "block" : "none";
  empty.style.display = list.length ? "none" : "block";

  const itemsEl = document.getElementById("shoppingListItems");
  itemsEl.innerHTML = "";
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "shopping-item" + (state.checkedItems.has(item) ? " checked" : "");
    row.innerHTML = `
      <label>
        <input type="checkbox" ${state.checkedItems.has(item) ? "checked" : ""} />
        <span>${escapeHtml(item)}</span>
      </label>
      <button class="remove-item-btn" aria-label="Remove ${escapeHtml(item)}">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#D99A9A" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    `;
    row.querySelector("input").onchange = () => {
      state.checkedItems.has(item) ? state.checkedItems.delete(item) : state.checkedItems.add(item);
      renderShoppingList();
    };
    row.querySelector(".remove-item-btn").onclick = () => {
      state.removedItems.add(item);
      renderShoppingList();
    };
    itemsEl.appendChild(row);
  });
}

function addExtraIngredient() {
  const input = document.getElementById("extraInput");
  if (!input.value.trim()) return;
  state.extraIngredients.push(input.value.trim());
  input.value = "";
  renderShoppingList();
}

function copyShoppingList() {
  const list = getShoppingList();
  const text = list.map(i => `${state.checkedItems.has(i) ? "[x]" : "[ ]"} ${i}`).join("\n");
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copyListBtn");
    btn.classList.add("copied");
    btn.innerHTML = "Copied";
    setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`; }, 1500);
  });
}

// ---------- Tabs ----------
function switchTab(tab) {
  state.tab = tab;
  ["cookbook", "random", "week"].forEach(t => {
    document.getElementById("view-" + t).style.display = t === tab ? "block" : "none";
  });
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
}

function renderAll() {
  renderCookbook();
  renderRandomTab();
  renderWeekTab();
}

// ---------- Wire up events ----------
document.getElementById("cookbookSearch").addEventListener("input", (e) => { state.cookbookSearch = e.target.value; renderCookbook(); });
document.getElementById("weekSearch").addEventListener("input", (e) => { state.weekSearch = e.target.value; renderWeekTab(); });
document.getElementById("openAddForm").addEventListener("click", () => openForm(null));
document.getElementById("closeForm").addEventListener("click", closeForm);
document.getElementById("saveRecipeBtn").addEventListener("click", saveRecipe);
document.getElementById("rollRandomBtn").addEventListener("click", rollRandom);
document.getElementById("addExtraBtn").addEventListener("click", addExtraIngredient);
document.getElementById("extraInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addExtraIngredient(); });
document.getElementById("copyListBtn").addEventListener("click", copyShoppingList);
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

// ---------- Start ----------
renderAll();
loadRecipes();
