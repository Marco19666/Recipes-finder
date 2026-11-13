
const themeToggle = document.querySelector("#theme-toggle");
const wakeToggle = document.querySelector("#wake-toggle");
const THEME_KEY = "recipe-finder-theme-v1";
const WAKE_KEY = "recipe-finder-wake-lock-v1";
let wakeLock = null;
let wakeEnabled = localStorage.getItem(WAKE_KEY) === "true";
function applyTheme(theme) {
  const dark = theme === "dark";
  document.body.dataset.theme = dark ? "dark" : "light";
  if (themeToggle) {
    themeToggle.textContent = dark ? "☀ Tema chiaro" : "☾ Tema scuro";
    themeToggle.setAttribute("aria-pressed", String(dark));
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#20251f" : "#3f6245");
}
applyTheme(localStorage.getItem(THEME_KEY) || "light");
themeToggle?.addEventListener("click", () => {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});
function updateWakeButton() {
  if (!wakeToggle) return;
  wakeToggle.textContent = wakeEnabled ? "✓ Schermo sempre acceso" : "♧ Schermo sempre acceso";
  wakeToggle.setAttribute("aria-pressed", String(wakeEnabled));
  wakeToggle.classList.toggle("is-active", wakeEnabled);
}
async function requestWakeLock() {
  if (!wakeEnabled || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (error) {
    if (wakeEnabled) notify("Il telefono o il browser non consentono di mantenere lo schermo acceso.");
  }
}
async function releaseWakeLock() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch (_) {}
    wakeLock = null;
  }
}
wakeToggle?.addEventListener("click", async () => {
  wakeEnabled = !wakeEnabled;
  localStorage.setItem(WAKE_KEY, String(wakeEnabled));
  updateWakeButton();
  if (wakeEnabled) {
    if (!("wakeLock" in navigator)) {
      wakeEnabled = false;
      localStorage.setItem(WAKE_KEY, "false");
      updateWakeButton();
      notify("Questa versione del browser non supporta lo schermo sempre acceso.");
      return;
    }
    await requestWakeLock();
    if (wakeEnabled) notify("Schermo sempre acceso attivato.");
  } else {
    await releaseWakeLock();
    notify("Schermo sempre acceso disattivato.");
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") requestWakeLock();
  else releaseWakeLock();
});
updateWakeButton();
if (wakeEnabled) requestWakeLock();

const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const resultsSection = document.querySelector("#results-section");
const resultsGrid = document.querySelector("#results");
const resultsTitle = document.querySelector("#results-title");
const resultCount = document.querySelector("#result-count");
const welcome = document.querySelector("#welcome");
const modal = document.querySelector("#recipe-modal");
const recipeContent = document.querySelector("#recipe-content");
const toast = document.querySelector("#toast");
const favoritesSection = document.querySelector("#favorites-section");
const favoritesGrid = document.querySelector("#favorites-grid");
const favoritesButton = document.querySelector("#show-favorites");
const favoritesCount = document.querySelector("#favorites-count");
const welcomeSection = document.querySelector("#welcome");
const personalSection = document.querySelector("#personal-section");
const personalGrid = document.querySelector("#personal-grid");
const personalButton = document.querySelector("#show-personal");
const personalCount = document.querySelector("#personal-count");
function setTryRecipesVisible(visible) {
  const section = document.querySelector(".try-recipes-section");
  if (!section) return;
  section.hidden = !visible;
  section.style.display = visible ? "" : "none";
}
const PERSONAL_KEY = "recipe-finder-personal-recipes-v1";
const FAVORITES_KEY = "recipe-finder-favorites-v1";
const SHOPPING_KEY = "recipe-finder-shopping-list-v1";
const HISTORY_KEY = "recipe-finder-search-history-v1";
const shoppingSection = document.querySelector("#shopping-section");
const shoppingList = document.querySelector("#shopping-list");
const shoppingCount = document.querySelector("#shopping-count");
const allSitesCheckbox = document.querySelector("#sites-all");
const siteCheckboxes = [...document.querySelectorAll('input[name="search-site"]')];
function getSelectedSites() { return siteCheckboxes.filter(input => input.checked).map(input => input.value); }
allSitesCheckbox.addEventListener("change", () => { siteCheckboxes.forEach(input => { input.checked = allSitesCheckbox.checked; }); });
siteCheckboxes.forEach(input => input.addEventListener("change", () => { allSitesCheckbox.checked = siteCheckboxes.every(site => site.checked); }));
function getPersonalRecipes() { try { return JSON.parse(localStorage.getItem(PERSONAL_KEY) || "[]"); } catch { return []; } }
function savePersonalRecipes(items) { localStorage.setItem(PERSONAL_KEY, JSON.stringify(items)); personalCount.textContent = items.length; }
function showPersonal() {
  setTryRecipesVisible(false);
  resultsSection.hidden = true; favoritesSection.hidden = true; shoppingSection.hidden = true; welcomeSection.hidden = true; document.querySelector("#history-section").hidden = true;
  personalSection.hidden = false;
  document.querySelector('#personal-form').hidden = true;
  document.querySelector('#personal-add').hidden = false;
  renderPersonalRecipes();
}
function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(""); return; }
    if (!file.type.startsWith("image/")) { reject(new Error("Scegli un file immagine.")); return; }
    if (file.size > 10 * 1024 * 1024) { reject(new Error("La foto deve essere inferiore a 10 MB.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Non riesco a leggere la foto."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("La foto non è valida."));
      img.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function renderPersonalRecipes() {
  const all = getPersonalRecipes();
  const term = (document.querySelector("#personal-search").value || "").trim().toLocaleLowerCase("it");
  const category = document.querySelector("#personal-category-filter").value;
  const items = all.filter(item => (!category || (item.category || "Altro") === category) &&
    (!term || (item.title + " " + (item.ingredients || []).join(" ")).toLocaleLowerCase("it").includes(term)));
  personalGrid.innerHTML = items.length ? items.map((item, index) =>
    '<article class="result-card">' + (item.photo ? '<img class="result-image" src="' + item.photo + '" alt="' + esc(item.title) + '" loading="eager">' : '<div class="result-placeholder" aria-hidden="true">✳</div>') + '<div class="result-body"><span class="result-source">Ricetta personale · ' + esc(item.category || "Altro") + '</span><h3>' + esc(item.title) + '</h3><div class="card-actions"><button class="recipe-button" data-personal-open="' + index + '">Apri ricetta</button><button class="favorite-remove" data-personal-delete="' + index + '">Elimina</button></div><button class="shopping-add" data-shopping-add="' + index + '" type="button">＋ Ingredienti nella lista</button></div></article>'
  ).join("") : '<div class="empty-state">' + (all.length ? "Nessuna ricetta corrisponde alla ricerca o categoria scelta." : "Non hai ancora aggiunto ricette personali. Premi “Aggiungi ricetta” per iniziare.") + '</div>';
  personalGrid.querySelectorAll("[data-personal-open]").forEach(button => button.addEventListener("click", () => showPersonalRecipe(items[Number(button.dataset.personalOpen)])));
  personalGrid.querySelectorAll("[data-personal-delete]").forEach(button => button.addEventListener("click", () => {
    const item = items[Number(button.dataset.personalDelete)];
    savePersonalRecipes(getPersonalRecipes().filter(saved => saved.id !== item.id)); renderPersonalRecipes();
    notify("Ricetta personale eliminata.");
  }));
  personalGrid.querySelectorAll("[data-shopping-add]").forEach(button => button.addEventListener("click", () => addShoppingIngredients(items[Number(button.dataset.shoppingAdd)].ingredients)));
}
function showPersonalRecipe(item) {
  modal.hidden = false; document.body.style.overflow = "hidden";
  const ingredients = item.ingredients.map(value => "<li>" + esc(value) + "</li>").join("");
  const steps = item.steps.map(value => "<li>" + esc(value) + "</li>").join("");
  recipeContent.innerHTML = '<span class="result-source">Ricetta personale</span><h2 id="recipe-title">' + esc(item.title) + '</h2>' +
    (item.photo ? '<img class="recipe-photo" src="' + item.photo + '" alt="' + esc(item.title) + '">' : '') +
    (item.time ? '<div class="recipe-meta">Tempo di preparazione: ' + esc(item.time) + ' min</div>' : '') +
    '<button type="button" class="shopping-add" id="personal-modal-shopping">＋ Ingredienti nella lista della spesa</button><h3>Ingredienti</h3><ul>' + ingredients + '</ul><h3>Preparazione</h3><ol>' + steps + '</ol>';
  document.querySelector("#personal-modal-shopping").addEventListener("click", () => addShoppingIngredients(item.ingredients));
}
function getFavorites() { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); } catch { return []; } }
function saveFavorites(items) { localStorage.setItem(FAVORITES_KEY, JSON.stringify(items)); updateFavoritesCount(); }
function updateFavoritesCount() { const count = getFavorites().length; favoritesCount.textContent = count; favoritesButton.setAttribute("aria-label", "Ricette preferite: " + count); }
function isFavorite(url) { return getFavorites().some(item => item.url === url); }
function toggleFavorite(item) {
  const items = getFavorites(); const exists = items.some(saved => saved.url === item.url);
  saveFavorites(exists ? items.filter(saved => saved.url !== item.url) : [item, ...items]);
  notify(exists ? "Ricetta rimossa dalle preferite." : "Ricetta salvata tra le preferite."); return !exists;
}
function showFavorites() { document.querySelector(".try-recipes-section").hidden = true; resultsSection.hidden = true; welcomeSection.hidden = true; personalSection.hidden = true; shoppingSection.hidden = true; document.querySelector("#history-section").hidden = true; favoritesSection.hidden = false; renderFavorites(); }
function renderFavoriteReview(item, index) {
  const rating = Math.max(0, Math.min(5, Number(item.rating) || 0));
  const stars = [1,2,3,4,5].map(value =>
    '<button type="button" class="review-star' + (value <= rating ? ' is-active' : '') + '" data-review-star="' + value + '" data-review-index="' + index + '" aria-label="' + value + ' stelle">★</button>'
  ).join("");
  return '<div class="favorite-review"><div class="review-stars" aria-label="Valutazione personale">' + stars + '</div><label for="favorite-note-' + index + '">La tua nota</label><textarea id="favorite-note-' + index + '" data-review-note="' + index + '" rows="2" maxlength="500" placeholder="Scrivi un appunto su questa ricetta...">' + esc(item.note || "") + '</textarea><button type="button" class="recipe-button review-save" data-review-save="' + index + '">Salva nota</button></div>';
}
function updateFavoriteReview(url, changes) {
  saveFavorites(getFavorites().map(item => item.url === url ? { ...item, ...changes } : item));
}

function renderFavorites() {
  const all = getFavorites();
  const term = (document.querySelector("#favorites-search").value || "").trim().toLocaleLowerCase("it");
  const category = document.querySelector("#favorites-category-filter").value;
  const items = all.filter(item => (!category || (item.category || "Altro") === category) &&
    (!term || (item.title + " " + (item.source || "")).toLocaleLowerCase("it").includes(term)));
  favoritesGrid.innerHTML = items.length ? items.map((item, index) => {
    const image = item.image ? '<img class="result-image" src="' + esc(item.image) + '" alt="' + esc(item.title) + '" loading="eager">' : '<div class="result-placeholder"></div>';
    return '<article class="result-card">' + image + '<div class="result-body"><span class="result-source">' + esc(item.source || "Ricetta salvata") + '</span><h3>' + esc(item.title) + '</h3><label class="favorite-category-label">Categoria <select class="favorite-category" data-favorite-category="' + index + '"><option' + ((item.category || "Altro") === "Primo" ? " selected" : "") + '>Primo</option><option' + (item.category === "Secondo" ? " selected" : "") + '>Secondo</option><option' + (item.category === "Contorno" ? " selected" : "") + '>Contorno</option><option' + (item.category === "Antipasto" ? " selected" : "") + '>Antipasto</option><option' + (item.category === "Dolce" ? " selected" : "") + '>Dolce</option><option' + ((item.category || "Altro") === "Altro" ? " selected" : "") + '>Altro</option></select></label>' + renderFavoriteReview(item, index) + '<div class="card-actions"><button class="recipe-button" data-favorite-open="' + index + '">Apri ricetta</button><button class="favorite-remove" data-favorite-remove="' + index + '">Rimuovi</button></div>' + (item.ingredients && item.ingredients.length ? '<button class="shopping-add" data-favorite-shopping="' + index + '" type="button">＋ Ingredienti nella lista</button>' : '') + '</div></article>';
  }).join("") : '<div class="empty-state">' + (all.length ? "Nessuna ricetta corrisponde alla ricerca o categoria scelta." : "Non hai ancora salvato ricette. Apri una ricetta e premi “Ricetta preferita”.") + '</div>';
  favoritesGrid.querySelectorAll("[data-favorite-open]").forEach(button => button.addEventListener("click", () => { const item = items[Number(button.dataset.favoriteOpen)]; loadRecipe(item.url, item); }));
  favoritesGrid.querySelectorAll("[data-favorite-remove]").forEach(button => button.addEventListener("click", () => { const item = items[Number(button.dataset.favoriteRemove)]; saveFavorites(getFavorites().filter(saved => saved.url !== item.url)); renderFavorites(); }));
  favoritesGrid.querySelectorAll("[data-favorite-category]").forEach(select => select.addEventListener("change", () => {
    const item = items[Number(select.dataset.favoriteCategory)];
    saveFavorites(getFavorites().map(saved => saved.url === item.url ? { ...saved, category: select.value } : saved));
    renderFavorites();
  }));
  favoritesGrid.querySelectorAll("[data-review-star]").forEach(button => button.addEventListener("click", () => {
    const item = items[Number(button.dataset.reviewIndex)];
    updateFavoriteReview(item.url, { rating: Number(button.dataset.reviewStar) });
    renderFavorites();
  }));
  favoritesGrid.querySelectorAll("[data-review-save]").forEach(button => button.addEventListener("click", () => {
    const item = items[Number(button.dataset.reviewSave)];
    const note = favoritesGrid.querySelector('[data-review-note="' + button.dataset.reviewSave + '"]').value.trim();
    updateFavoriteReview(item.url, { note });
    notify("Nota personale salvata.");
    renderFavorites();
  }));
  favoritesGrid.querySelectorAll("[data-favorite-shopping]").forEach(button => button.addEventListener("click", () => addShoppingIngredients(items[Number(button.dataset.favoriteShopping)].ingredients)));
}
updateFavoritesCount();

const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

async function fetchSuggestion(query, dayNumber, slot, sites) {
  const firstIndex = (dayNumber + slot * 3) % sites.length;
  const orderedSites = [sites[firstIndex], sites[(firstIndex + 1) % sites.length]];
  for (const site of orderedSites) {
    try {
      const response = await fetch("/api/search?q=" + encodeURIComponent(query) + "&sites=" + encodeURIComponent(site) + "&_=" + Date.now(), { cache: "no-store" });
      if (!(response.headers.get("content-type") || "").includes("application/json")) continue;
      const payload = await response.json();
      if (!response.ok) continue;
      const item = (payload.results || []).find(result => result && result.title && result.url);
      if (item) return item;
    } catch {}
  }
  return null;
}
function renderSuggestionCard(item, index, extraClass = "", category = "") {
  const image = item.image
    ? '<img class="result-image" src="' + esc(item.image) + '" alt="' + esc(item.title) + '" loading="lazy" referrerpolicy="no-referrer">'
    : '<div class="result-placeholder" aria-hidden="true">✳</div>';
  const description = esc((item.description || "Scopri ingredienti e preparazione di questa ricetta.").slice(0, 180));
  const categoryLabel = category ? '<span class="suggestion-category">' + esc(category) + '</span>' : '';
  return '<article class="result-card ' + extraClass + '">' + image + '<div class="result-body">' + categoryLabel + '<span class="result-source">' + esc(item.source || "Ricetta selezionata") + '</span><h3>' + esc(item.title) + '</h3><p>' + description + '</p><div class="card-actions"><button class="recipe-button" type="button" data-suggestion-open="' + index + '">Scopri la ricetta</button></div></div></article>';
}
function bindSuggestionButtons(container, items) {
  container.querySelectorAll("[data-suggestion-open]").forEach(button => {
    button.addEventListener("click", () => {
      const item = items[Number(button.dataset.suggestionOpen)];
      if (item) loadRecipe(item.url, item);
    });
  });
}
async function loadDailyRecipe() {
  const dailyGrid = document.querySelector("#daily-recipe");
  const tryGrid = document.querySelector("#try-recipes");
  const dailyQueries = ["pasta al forno","pollo al limone","risotto ai funghi","parmigiana di melanzane","polpette al sugo","torta di mele","lasagne","pasta alla carbonara","frittata di verdure","tiramisù","salmone al forno","gnocchi al pomodoro","crostata","spezzatino","pasta al pesto"];
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const dailySites = ["misya.info","cookist.it","cucchiaio.it","fattoincasadabenedetta.it","ricettedellanonna.net","tavolartegusto.it"];
  if (dailyGrid) {
    const query = dailyQueries[((dayNumber % dailyQueries.length) + dailyQueries.length) % dailyQueries.length];
    dailyGrid.innerHTML = '<div class="empty-state">Sto scegliendo la ricetta di oggi...</div>';
    const item = await fetchSuggestion(query, dayNumber, 0, dailySites);
    if (item) {
      dailyGrid.innerHTML = renderSuggestionCard(item, 0, "daily-recipe-card");
      bindSuggestionButtons(dailyGrid, [item]);
    } else {
      dailyGrid.innerHTML = '<div class="empty-state">La ricetta del giorno non è disponibile in questo momento. Riprova tra poco.</div>';
    }
  }
  if (tryGrid) {
    const tryCategories = [
      { label: "Antipasto", queries: ["bruschette pomodoro", "crostini sfiziosi", "involtini di melanzane", "frittelle salate"] },
      { label: "Primo", queries: ["risotto ai funghi", "pasta alla norma", "lasagne vegetariane", "pasta al pesto"] },
      { label: "Secondo", queries: ["pollo alla cacciatora", "polpette al sugo", "orata al forno", "polpettone al forno"] },
      { label: "Contorno", queries: ["patate al forno", "verdure gratinate", "zucchine trifolate", "melanzane grigliate"] },
      { label: "Dolce", queries: ["crostata alla marmellata", "torta di mele", "cheesecake al limone", "tiramisù"] }
    ];
    tryGrid.innerHTML = '<div class="empty-state">Sto preparando il menu di oggi: antipasto, primo, secondo, contorno e dolce...</div>';
    const choices = tryCategories.map((category, index) => ({
      ...category,
      query: category.queries[Math.floor(dayNumber / 5 + index * 7) % category.queries.length]
    }));
    const found = await Promise.all(choices.map((category, index) =>
      fetchSuggestion(category.query, dayNumber, index + 1, dailySites)
    ));
    const seen = new Set();
    const suggestions = choices.map((category, index) => {
      const item = found[index];
      if (!item) return { category: category.label, item: null };
      const urlKey = String(item.url).replace(/#.*$/, "").toLowerCase();
      const titleKey = String(item.title || "").trim().toLocaleLowerCase("it");
      if (seen.has(urlKey) || seen.has(titleKey)) return { category: category.label, item: null };
      seen.add(urlKey);
      seen.add(titleKey);
      return { category: category.label, item };
    });
    tryGrid.innerHTML = suggestions.map((entry, index) => entry.item
      ? renderSuggestionCard(entry.item, index, "try-recipe-card", entry.category)
      : '<article class="result-card try-recipe-card suggestion-unavailable"><div class="result-placeholder" aria-hidden="true">✳</div><div class="result-body"><span class="suggestion-category">' + esc(entry.category) + '</span><h3>Ricetta non disponibile</h3><p>Oggi non è stato possibile trovare una proposta per questa portata.</p></div></article>'
    ).join("");
    bindSuggestionButtons(tryGrid, suggestions.map(entry => entry.item));
    const count = document.querySelector("#try-recipes-count");
    if (count) count.textContent = "Menu completo · 5 portate";
  }
}
function notify(message, duration = 3200) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), duration);
}
function setLoading(loading) {
  const button = form.querySelector("button");
  button.disabled = loading;
  button.innerHTML = loading ? "Cerco..." : 'Cerca ricette <span aria-hidden="true">↗</span>';
}

function getSearchHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } }
function saveSearchHistory(query) {
  const normalized = String(query || "").trim();
  if (!normalized) return;
  const items = getSearchHistory().filter(item => item.query.toLocaleLowerCase("it") !== normalized.toLocaleLowerCase("it"));
  items.unshift({ query: normalized, date: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
}
function renderSearchHistory() {
  const grid = document.querySelector("#history-list");
  const items = getSearchHistory();
  grid.innerHTML = items.length ? items.map((item, index) =>
    '<div class="history-item"><button type="button" class="history-query" data-history-run="' + index + '">' + esc(item.query) + '</button><button type="button" class="favorite-remove" data-history-delete="' + index + '" aria-label="Elimina ricerca">Elimina</button></div>'
  ).join("") : '<div class="empty-state">Non hai ancora effettuato ricerche.</div>';
  grid.querySelectorAll("[data-history-run]").forEach(button => button.addEventListener("click", () => searchRecipes(items[Number(button.dataset.historyRun)].query)));
  grid.querySelectorAll("[data-history-delete]").forEach(button => button.addEventListener("click", () => {
    const selected = items[Number(button.dataset.historyDelete)];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(getSearchHistory().filter(item => item.query !== selected.query)));
    renderSearchHistory();
  }));
}
function showHistory() {
  setTryRecipesVisible(false);
  resultsSection.hidden = true; favoritesSection.hidden = true; personalSection.hidden = true; shoppingSection.hidden = true; welcomeSection.hidden = true;
  document.querySelector("#history-section").hidden = false;
  renderSearchHistory();
}

async function searchRecipes(query) {
  queryInput.value = query;
  saveSearchHistory(query);
  const selectedSites = getSelectedSites();
  if (!selectedSites.length) { notify("Seleziona almeno un sito per avviare la ricerca."); return; }
  setTryRecipesVisible(false);
  setLoading(true);
  welcome.hidden = true;
  document.querySelector("#history-section").hidden = true;
  favoritesSection.hidden = true;
  personalSection.hidden = true;
  shoppingSection.hidden = true;
  resultsSection.hidden = false;
  resultsTitle.textContent = "Ricette: " + query;
  resultCount.textContent = "Ricerca in corso";
  const progress = document.querySelector("#search-progress");
  const progressTitle = document.querySelector("#search-progress-title");
  const progressDetail = document.querySelector("#search-progress-detail");
  const progressBar = document.querySelector("#search-progress-bar");
  if (progress) progress.hidden = false;
  if (progress) progress.classList.remove("is-done");
  const found = [];
  const seen = new Set();
  const failedSites = [];
  const durations = [];
  const startedAt = Date.now();
  const renderResults = () => {
    resultsGrid.innerHTML = found.length ? found.map((item, index) => {
      const image = item.image ? '<img class="result-image" src="' + esc(item.image) + '" alt="' + esc(item.title) + '" loading="eager" referrerpolicy="no-referrer">' : '<div class="result-placeholder" aria-hidden="true"></div>';
      const description = esc((item.description || "").slice(0, 150)) + ((item.description || "").length > 150 ? "…" : "");
      return '<article class="result-card">' + image +
        '<div class="result-body"><span class="result-source">' + esc(item.source) + '</span>' +
        '<h3>' + esc(item.title) + '</h3><p>' + description + '</p>' +
        '<div class="card-actions"><button class="recipe-button" data-recipe="' + index + '">Ingredienti e procedimento</button></div></div></article>';
    }).join("") : '<div class="empty-state">Sto cercando ricette complete nelle fonti selezionate...</div>';
    resultsGrid.querySelectorAll("[data-recipe]").forEach(button => {
      button.addEventListener("click", () => loadRecipe(found[Number(button.dataset.recipe)].url, found[Number(button.dataset.recipe)]));
    });
    resultCount.textContent = found.length + (found.length === 1 ? " ricetta valida" : " ricette valide");
  };
  try {
    let completed = 0;
    for (let index = 0; index < selectedSites.length && found.length < 12; index++) {
      const site = selectedSites[index];
      const averageMs = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 10000;
      const remainingEstimate = Math.ceil((averageMs * (selectedSites.length - index)) / 1000);
      if (progressTitle) progressTitle.textContent = "Sto consultando " + site;
      if (progressDetail) progressDetail.textContent = "Sito " + (index + 1) + " di " + selectedSites.length + " · tempo stimato rimanente: circa " + remainingEstimate + " secondi";
      if (progressBar) progressBar.style.width = Math.round((index / selectedSites.length) * 100) + "%";
      const siteStarted = Date.now();
      try {
        const response = await fetch("/api/search?q=" + encodeURIComponent(query) + "&sites=" + encodeURIComponent(site) + "&_=" + Date.now(), { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("Risposta non valida");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Ricerca non disponibile");
        for (const item of payload.results || []) {
          if (item && item.title && item.url && !seen.has(item.url)) {
            seen.add(item.url);
            found.push(item);
            if (found.length >= 12) break;
          }
        }
      } catch (error) {
        failedSites.push(site);
      }
      durations.push(Date.now() - siteStarted);
      completed++;
      renderResults();
      if (progressBar) progressBar.style.width = Math.round((completed / selectedSites.length) * 100) + "%";
    }
    if (progress) progress.classList.add("is-done");
    if (progressTitle) progressTitle.textContent = found.length >= 12 ? "Obiettivo raggiunto" : "Ricerca completata";
    if (progressDetail) {
      const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      progressDetail.textContent = "Consultati " + completed + " siti in " + duration + " secondi." +
        (failedSites.length ? " Fonti non raggiungibili: " + failedSites.join(", ") + "." : "");
    }
    if (progressBar) progressBar.style.width = "100%";
    if (!found.length) {
      resultsGrid.innerHTML = '<div class="empty-state">Non ho trovato ricette complete per questa ricerca. Prova con un altro ingrediente o piatto.</div>';
      resultCount.textContent = "Nessuna ricetta valida";
    }
  } catch (error) {
    resultsGrid.innerHTML = '<div class="error-state">' + esc(error.message) + '<br><br>La ricerca automatica non è riuscita. Riprova tra qualche secondo.</div>';
    resultCount.textContent = "Ricerca non riuscita";
  } finally {
    setLoading(false);
  }
}

async function loadRecipe(url, fallback = {}) {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  recipeContent.innerHTML = '<div class="empty-state">Sto leggendo la ricetta dalla fonte originale...</div>';
  try {
    const response = await fetch("/api/recipe?url=" + encodeURIComponent(url), { cache: "no-store", headers: { "Accept": "application/json; charset=utf-8" } });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Il sito della ricetta ha restituito una risposta non valida. Riprova più tardi.");
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Non è stato possibile leggere la ricetta.");
    const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
    const instructions = Array.isArray(data.instructions) ? data.instructions : [data.instructions].filter(Boolean);
    const calories = data.calories_per_serving !== null && data.calories_per_serving !== undefined && data.calories_per_serving !== "" && Number.isFinite(Number(data.calories_per_serving)) ? Number(data.calories_per_serving) : null;
    const calorieReview = calories === null
      ? "Dati insufficienti: la fonte non fornisce calorie e non ci sono ingredienti quantificabili."
      : (data.calories_estimated ? (data.calories_partial ? "Stima parziale: circa " : "Stima indicativa: circa ") : "Valore dichiarato dalla fonte: ") + calories + " kcal per porzione · " + (calories <= 600 ? "IN LINEA" : "OLTRE SOGLIA") + " (soglia orientativa 600 kcal)." + (data.calories_partial ? " Alcuni ingredienti non sono stati riconosciuti: il valore potrebbe essere sottostimato." : "");
    const meta = data.total_time ? "Tempo totale: " + data.total_time + " min" : "";
    const portions = '<div class="recipe-portions"><span>PORZIONI</span><strong>' + esc(data.yields || "Non indicate") + '</strong></div>';
    const calorieStatus = calories === null ? "unknown" : (calories <= 600 ? "ok" : "over");
    const calorieFooter = '<div class="calorie-review"><strong>Valutazione calorica</strong><span class="calorie-review-status calorie-review-status--' + calorieStatus + '">' + esc(calorieReview.replace(/^Valutazione calorica: /, "")) + '</span></div>';
    const image = data.image ? '<img class="recipe-image" src="' + esc(data.image) + '" alt="" referrerpolicy="no-referrer">' : "";
    const ingredientList = ingredients.length ? "<ul>" + ingredients.map(item => "<li>" + esc(item) + "</li>").join("") + "</ul>" : "<p>Ingredienti non disponibili in formato leggibile.</p>";
    const steps = instructions.length ? "<ol>" + instructions.map(item => "<li>" + esc(item) + "</li>").join("") + "</ol>" : "<p>Procedimento non disponibile in formato leggibile.</p>";
    const savedItem = { url, title: data.title || fallback.title || "Ricetta", image: data.image || fallback.image || "", source: data.source || fallback.source || "", description: fallback.description || "", ingredients, yields: data.yields || null, total_time: data.total_time || null, calories_per_serving: calories, category: fallback.category || "Altro" };
    if (isFavorite(url)) { saveFavorites(getFavorites().map(item => item.url === url ? { ...item, ...savedItem } : item)); }
    recipeContent.innerHTML = '<span class="result-source">' + esc(data.source || fallback.source || "Fonte originale") + '</span>' +
      '<h2 id="recipe-title">' + esc(data.title || fallback.title || "Ricetta") + '</h2>' + (meta ? '<div class="recipe-meta">' + esc(meta) + '</div>' : '') +
      '<button type="button" id="toggle-favorite" class="favorite-toggle" aria-pressed="' + isFavorite(url) + '">' + (isFavorite(url) ? "♥ Ricetta preferita" : "♡ Ricetta preferita") + '</button>' +
      '<button type="button" id="recipe-shopping" class="shopping-add">＋ Ingredienti nella lista della spesa</button>' +
      image + portions + '<h3>Ingredienti</h3>' + ingredientList + '<h3>Preparazione</h3>' + steps + calorieFooter;
    document.querySelector("#recipe-shopping").addEventListener("click", () => addShoppingIngredients(ingredients));
    document.querySelector("#toggle-favorite").addEventListener("click", () => {
      const button = document.querySelector("#toggle-favorite");
      const existing = isFavorite(url);
      if (existing) {
        toggleFavorite(savedItem);
        button.textContent = "♡ Ricetta preferita";
        button.setAttribute("aria-pressed", "false");
        const chooser = document.querySelector("#favorite-category-choice");
        if (chooser) chooser.remove();
        return;
      }
      let chooser = document.querySelector("#favorite-category-choice");
      if (chooser) return;
      chooser = document.createElement("div");
      chooser.id = "favorite-category-choice";
      chooser.className = "favorite-category-choice";
      chooser.innerHTML = '<label for="favorite-save-category">In quale categoria vuoi salvarla?</label><select id="favorite-save-category"><option value="" selected disabled>Scegli una categoria</option><option>Primo</option><option>Secondo</option><option>Contorno</option><option>Antipasto</option><option>Dolce</option><option>Altro</option></select><button type="button" class="recipe-button" id="confirm-favorite-category">Salva tra le preferite</button>';
      button.insertAdjacentElement("afterend", chooser);
      document.querySelector("#confirm-favorite-category").addEventListener("click", () => {
        const category = document.querySelector("#favorite-save-category").value;
        if (!category) { notify("Scegli una categoria prima di salvare."); return; }
        toggleFavorite({ ...savedItem, category });
        button.textContent = "♥ Ricetta preferita";
        button.setAttribute("aria-pressed", "true");
        chooser.remove();
      });
    });
  } catch (error) {
    recipeContent.innerHTML = '<div class="error-state">' + esc(error.message) + '</div>';
  }
}

function getShoppingItems() { try { return JSON.parse(localStorage.getItem(SHOPPING_KEY) || "[]"); } catch { return []; } }
function saveShoppingItems(items) {
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(items));
  shoppingCount.textContent = items.length;
}
function addShoppingIngredients(ingredients) {
  const items = getShoppingItems();
  const known = new Set(items.map(item => item.text.toLocaleLowerCase("it")));
  let added = 0;
  (ingredients || []).forEach(value => {
    const text = String(value).trim();
    if (text && !known.has(text.toLocaleLowerCase("it"))) {
      items.push({ id: String(Date.now()) + "-" + added, text, checked: false });
      known.add(text.toLocaleLowerCase("it")); added++;
    }
  });
  saveShoppingItems(items);
  notify(added ? added + " ingredienti aggiunti alla lista." : "Gli ingredienti sono già nella lista.");
}
function renderShoppingList() {
  const items = getShoppingItems();
  shoppingList.innerHTML = items.length ? items.map(item =>
    '<div class="shopping-item"><input type="checkbox" aria-label="Segna come acquistato" data-shopping-check="' + esc(item.id) + '"' + (item.checked ? " checked" : "") + '><span' + (item.checked ? ' class="checked"' : '') + '>' + esc(item.text) + '</span><button type="button" class="favorite-remove" data-shopping-delete="' + esc(item.id) + '">Rimuovi</button></div>'
  ).join("") : '<div class="empty-state">La lista è vuota. Apri una ricetta e premi “Ingredienti nella lista della spesa”.</div>';
  shoppingList.querySelectorAll("[data-shopping-check]").forEach(input => input.addEventListener("change", () => {
    saveShoppingItems(getShoppingItems().map(item => item.id === input.dataset.shoppingCheck ? { ...item, checked: input.checked } : item));
    renderShoppingList();
  }));
  shoppingList.querySelectorAll("[data-shopping-delete]").forEach(button => button.addEventListener("click", () => {
    saveShoppingItems(getShoppingItems().filter(item => item.id !== button.dataset.shoppingDelete)); renderShoppingList();
  }));
}
function showShopping() {
  setTryRecipesVisible(false);
  resultsSection.hidden = true; favoritesSection.hidden = true; personalSection.hidden = true; welcomeSection.hidden = true;
  document.querySelector("#history-section").hidden = true;
  shoppingSection.hidden = false; renderShoppingList();
}
shoppingCount.textContent = getShoppingItems().length;
document.querySelector("#show-shopping").addEventListener("click", showShopping);
document.querySelector("#show-history").addEventListener("click", showHistory);
document.querySelector("#history-back").addEventListener("click", () => { document.querySelector("#history-section").hidden = true; welcomeSection.hidden = false; setTryRecipesVisible(true); });
document.querySelector("#history-clear").addEventListener("click", () => { localStorage.removeItem(HISTORY_KEY); renderSearchHistory(); notify("Cronologia cancellata."); });
document.querySelector("#shopping-back").addEventListener("click", () => { shoppingSection.hidden = true; welcomeSection.hidden = false; setTryRecipesVisible(true); });
document.querySelector("#shopping-clear").addEventListener("click", () => {
  saveShoppingItems([]); renderShoppingList(); notify("Lista della spesa svuotata.");
});

personalCount.textContent = getPersonalRecipes().length;
document.querySelector("#personal-search").addEventListener("input", renderPersonalRecipes);
document.querySelector("#personal-category-filter").addEventListener("change", renderPersonalRecipes);
personalButton.addEventListener("click", showPersonal);
document.querySelector('#personal-add').addEventListener('click', () => {
  document.querySelector('#personal-form').hidden = false;
  document.querySelector('#personal-add').hidden = true;
  document.querySelector('#personal-title').focus();
});
document.querySelector("#personal-back").addEventListener("click", () => { personalSection.hidden = true; welcomeSection.hidden = false; setTryRecipesVisible(true); });
document.querySelector("#personal-form").addEventListener("submit", async event => {
  event.preventDefault();
  const title = document.querySelector("#personal-title").value.trim();
  const ingredients = document.querySelector("#personal-ingredients").value.split("\n").map(x => x.trim()).filter(Boolean);
  const steps = document.querySelector("#personal-steps").value.split("\n").map(x => x.trim()).filter(Boolean);
  const time = document.querySelector("#personal-time").value.trim();
  const photoFile = document.querySelector("#personal-photo").files[0];
  if (!title || !ingredients.length || !steps.length) { notify("Compila nome, ingredienti e preparazione."); return; }
  try {
    const photo = await imageToDataUrl(photoFile);
    const items = getPersonalRecipes();
    items.unshift({ id: String(Date.now()), title, category: document.querySelector("#personal-category").value, ingredients, steps, time, photo });
    savePersonalRecipes(items);
    event.target.reset();
    event.target.hidden = true;
    document.querySelector("#personal-add").hidden = false;
    renderPersonalRecipes();
    notify("Ricetta personale salvata.");
  } catch (error) { notify(error.message || "Non riesco a salvare la foto."); }
});
favoritesButton.addEventListener("click", showFavorites);
document.querySelector("#favorites-search").addEventListener("input", renderFavorites);
document.querySelector("#favorites-category-filter").addEventListener("change", renderFavorites);
document.querySelector("#back-home").addEventListener("click", () => { favoritesSection.hidden = true; welcomeSection.hidden = false; document.querySelector(".try-recipes-section").hidden = false; });
form.addEventListener("submit", event => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query.length >= 2) searchRecipes(query);
});
document.querySelectorAll("[data-query]").forEach(button => {
  button.addEventListener("click", () => searchRecipes(button.dataset.query));
});
modal.querySelectorAll("[data-close]").forEach(element => {
  element.addEventListener("click", () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  });
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modal.hidden) {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
});


const splash = document.querySelector("#app-splash");
let splashDismissed = false;
function dismissSplash() {
  if (splashDismissed || !splash) return;
  splashDismissed = true;
  splash.classList.add("is-hidden");
  window.setTimeout(() => splash.remove(), 400);
}
const splashFailsafe = window.setTimeout(dismissSplash, 15000);
loadDailyRecipe().catch(error => {
  console.error("Errore nel caricamento dei suggerimenti iniziali:", error);
}).finally(() => {
  const finishSplash = () => {
    window.clearTimeout(splashFailsafe);
    dismissSplash();
  };
  if (document.readyState === "complete") finishSplash();
  else window.addEventListener("load", finishSplash, { once: true });
});

let deferredInstallPrompt=null;
const installButton=document.querySelector("#install-app");
if(installButton){
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();deferredInstallPrompt=event;installButton.hidden=false;
  });
  window.addEventListener("appinstalled",()=>{
    deferredInstallPrompt=null;installButton.hidden=true;notify("Cosa Cucino? è stata installata.");
  });
  installButton.addEventListener("click",async()=>{
    if(!deferredInstallPrompt){
      notify("Per installarla su Android: apri il menu ⋮ di Chrome e scegli “Installa app” oppure “Aggiungi a schermata Home”.",6500);
      return;
    }
    deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;
  });
}
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));


// Archimede: massimo 2 consigli al giorno per dispositivo.
const archimedeSection=document.querySelector("#archimede-section");
const archimedeButton=document.querySelector("#show-archimede");
const archimedeBack=document.querySelector("#archimede-back");
const archimedeForm=document.querySelector("#archimede-form");
const archimedeIngredients=document.querySelector("#archimede-ingredients");
const archimedeSubmit=document.querySelector("#archimede-submit");
const archimedeResult=document.querySelector("#archimede-result");
const ARCHIMEDE_DAILY_LIMIT=2;
const ARCHIMEDE_QUOTA_KEY="cosa-cucino-archimede-quota-v1";
const archimedeQuotaLabel=document.querySelector("#archimede-quota");
function archimedeQuotaState(){
  const today=new Date().toLocaleDateString("en-CA");
  let state={date:today,used:0};
  try{const saved=JSON.parse(localStorage.getItem(ARCHIMEDE_QUOTA_KEY)||"null");if(saved?.date===today&&Number.isFinite(saved.used))state={date:today,used:Math.max(0,Math.min(ARCHIMEDE_DAILY_LIMIT,saved.used))};}catch(_){}
  return state;
}
function archimedeUpdateQuota(){
  const state=archimedeQuotaState(),remaining=Math.max(0,ARCHIMEDE_DAILY_LIMIT-state.used);
  if(archimedeQuotaLabel)archimedeQuotaLabel.textContent=remaining+" consigli disponibili oggi";
  if(archimedeSubmit)archimedeSubmit.disabled=remaining===0;
  return remaining;
}
function archimedeUseQuota(){
  const state=archimedeQuotaState();
  if(state.used>=ARCHIMEDE_DAILY_LIMIT)return false;
  state.used++;
  localStorage.setItem(ARCHIMEDE_QUOTA_KEY,JSON.stringify(state));
  archimedeUpdateQuota();
  return true;
}
archimedeUpdateQuota();
function archimedeShow(){
  setTryRecipesVisible(false);
  for(const id of ["daily-recipe-section","results-section","favorites-section","personal-section","shopping-section","history-section","welcome","chef-section"]){
    const node=document.getElementById(id);if(node)node.hidden=true;
  }
  document.querySelector(".hero").hidden=true;
  archimedeSection.hidden=false;
  archimedeIngredients.focus();
}
archimedeButton?.addEventListener("click",archimedeShow);
archimedeBack?.addEventListener("click",()=>{
  archimedeSection.hidden=true;
  document.querySelector(".hero").hidden=false;
  document.querySelector("#daily-recipe-section").hidden=false;
  welcome.hidden=false;
  setTryRecipesVisible(true);
});
function archimedeNode(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=String(text);
  return node;
}
function archimedeList(parent,title,items,kind){
  if(!Array.isArray(items)||!items.length)return;
  const section=archimedeNode("section","archimede-ingredient-group archimede-ingredient-group--"+kind);
  section.appendChild(archimedeNode("h4","",title));
  const list=archimedeNode("ul","");
  for(const item of items){
    const name=typeof item==="string"?item:item?.name;
    if(!name)continue;
    const li=archimedeNode("li","",name);
    if(item?.reason)li.appendChild(archimedeNode("small","",item.reason));
    list.appendChild(li);
  }
  section.appendChild(list);parent.appendChild(section);
}
function archimedeRender(recipe){
  archimedeResult.replaceChildren();
  archimedeResult.hidden=false;
  archimedeResult.appendChild(archimedeNode("div","archimede-result-kicker","LA PROPOSTA DI ARCHIMEDE"));
  archimedeResult.appendChild(archimedeNode("h3","",recipe.title||"La tua ricetta"));
  if(recipe.intro)archimedeResult.appendChild(archimedeNode("p","archimede-recipe-intro",recipe.intro));
  const meta=archimedeNode("div","archimede-recipe-meta");
  for(const value of [recipe.time_minutes?recipe.time_minutes+" minuti":"",recipe.difficulty||"",recipe.servings?recipe.servings+" porzioni":""]){
    if(value)meta.appendChild(archimedeNode("span","",value));
  }
  if(meta.childNodes.length)archimedeResult.appendChild(meta);
  const ingredients=archimedeNode("div","archimede-ingredient-groups");
  archimedeList(ingredients,"✓ Hai e utilizzi",recipe.available,"available");
  archimedeList(ingredients,"! Ti manca",recipe.missing,"missing");
  archimedeList(ingredients,"＋ Facoltativi",recipe.optional,"optional");
  if(ingredients.childNodes.length)archimedeResult.appendChild(ingredients);
  if(Array.isArray(recipe.steps)&&recipe.steps.length){
    archimedeResult.appendChild(archimedeNode("h4","archimede-steps-title","Preparazione"));
    const steps=archimedeNode("ol","archimede-steps");
    recipe.steps.forEach(step=>steps.appendChild(archimedeNode("li","",step)));
    archimedeResult.appendChild(steps);
  }
  archimedeResult.scrollIntoView({behavior:"smooth",block:"start"});
}
archimedeForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const ingredients=archimedeIngredients.value.trim();
  const category=archimedeForm.querySelector('input[name="archimede-category"]:checked')?.value||"Primo";
  if(!ingredients)return;
  if(archimedeUpdateQuota()<=0){archimedeResult.hidden=false;archimedeResult.replaceChildren(archimedeNode("p","archimede-error","Hai già utilizzato i 2 consigli di oggi. Torna domani!"));return;}
  archimedeSubmit.disabled=true;
  archimedeSubmit.textContent="Archimede sta pensando…";
  archimedeResult.hidden=false;
  archimedeResult.replaceChildren(archimedeNode("p","archimede-loading","Sto preparando una ricetta con i tuoi ingredienti…"));
  try{
    const response=await fetch("/api/archimede/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ingredients,category})});
    const raw=await response.text();
    let data={};try{data=raw?JSON.parse(raw):{}}catch{throw new Error("Il server ha restituito una risposta non valida.");}
    if(!response.ok)throw new Error(data.detail||"Non riesco a contattare Archimede. Riprova.");
    if(!data.recipe)throw new Error("Non ho ricevuto una ricetta completa. Riprova.");
    archimedeUseQuota();
    archimedeRender(data.recipe);
  }catch(error){
    archimedeResult.replaceChildren(archimedeNode("p","archimede-error",error.message||"Si è verificato un errore."));
  }finally{
    archimedeUpdateQuota();
    archimedeSubmit.textContent="Chiedi ad Archimede ✨";
  }
});

// Assistente Chiedi allo chef: modalità test senza limite giornaliero.
const CHEF_DEVICE_KEY="cosa-cucino-chef-device-v1";
const chefSection=document.querySelector("#chef-section"),chefButton=document.querySelector("#show-chef"),chefMessages=document.querySelector("#chef-messages"),chefForm=document.querySelector("#chef-form"),chefQuestion=document.querySelector("#chef-question"),chefQuota=document.querySelector("#chef-quota"),chefSend=document.querySelector("#chef-send");
let chefConversation=[];
function chefDeviceId(){let id=localStorage.getItem(CHEF_DEVICE_KEY);if(!id){id=crypto.randomUUID?crypto.randomUUID():"chef-"+Date.now()+"-"+Math.random().toString(36).slice(2);localStorage.setItem(CHEF_DEVICE_KEY,id)}return id}
function chefAddMessage(role,content){const node=document.createElement("div");node.className="chef-message chef-message--"+role;node.textContent=content;chefMessages.appendChild(node);chefMessages.scrollTop=chefMessages.scrollHeight}
async function refreshChefQuota(){try{const r=await fetch("/api/chef/status?device_id="+encodeURIComponent(chefDeviceId()),{cache:"no-store"});const d=await r.json();if(r.ok)chefQuota.textContent=d.remaining+" di 5 domande disponibili oggi"}catch(_){}}
function chefShow(){setTryRecipesVisible(false);for(const id of ["daily-recipe-section","results-section","favorites-section","personal-section","shopping-section","history-section","welcome"]){const n=document.getElementById(id);if(n)n.hidden=true}document.querySelector(".hero").hidden=true;chefSection.hidden=false;refreshChefQuota();chefQuestion.focus()}
chefButton?.addEventListener("click",chefShow);
document.querySelector("#chef-back")?.addEventListener("click",()=>{chefSection.hidden=true;document.querySelector(".hero").hidden=false;document.querySelector("#daily-recipe-section").hidden=false;welcome.hidden=false;setTryRecipesVisible(true)});
chefForm?.addEventListener("submit",async e=>{e.preventDefault();const q=chefQuestion.value.trim();if(!q||chefSend.disabled)return;chefSend.disabled=true;chefSend.textContent="Un momento…";chefAddMessage("user",q);chefConversation.push({role:"user",content:q});chefQuestion.value="";const wait=document.createElement("div");wait.className="chef-message chef-message--assistant";wait.textContent="Lo chef sta pensando…";chefMessages.appendChild(wait);try{const r=await fetch("/api/chef/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({device_id:chefDeviceId(),messages:chefConversation.slice(-8)})});const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch{d={detail:raw||"Risposta non valida dal server."}}wait.remove();if(!r.ok){if(r.status===429)chefQuota.textContent="0 di 5 domande disponibili oggi";else if(d.remaining!==undefined)chefQuota.textContent=d.remaining+" di 5 domande disponibili oggi";throw new Error(d.detail||d.error||"Non riesco a contattare lo chef. Riprova tra poco.")}if(d.off_topic){chefConversation.pop()}else{chefConversation.push({role:"assistant",content:d.answer});chefQuota.textContent=d.remaining+" di 5 domande disponibili oggi"}chefAddMessage("assistant",d.answer)}catch(err){wait.remove();chefAddMessage("assistant",err.message||"Si è verificato un errore.");chefConversation.pop()}finally{chefSend.disabled=false;chefSend.textContent="Invia ↗";chefQuestion.focus()}});
