const DEFAULT_FAVORITES = [
  { name: "Leichweg", locationName: "Köln Raderthal Leichweg" },
  { name: "Brühler Str./ Gürtel", locationName: "Köln Raderthal Brühler Str./Gürtel" },
  { name: "Zollstockgürtel", locationName: "Köln Zollstock Zollstockgürtel" },
  { name: "Bernkasteler Str.", locationName: "Köln Zollstock Bernkasteler Str." },
  { name: "Gottesweg", locationName: "Köln Zollstock Gottesweg" },
  { name: "Zülpicher Platz", locationName: "Köln Zülpicher Platz" },
  { name: "Barbarossaplatz", locationName: "Köln Barbarossaplatz" }
];

const FAV_KEY = "kvb_favorites_v2";
const DEPARTURE_CACHE_PREFIX = "kvb_departures_cache_v1_";
const favoriteList = document.getElementById("favoriteList");
const searchResults = document.getElementById("searchResults");
const openFavorites = new Map();
const updateStatus = document.getElementById("updateStatus");
const THEME_KEY = "kvb_theme";
const directionFilters = new Map();
const expandedDepartures = new Set();

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAV_KEY));
    const favorites = Array.isArray(stored) && stored.length ? stored : DEFAULT_FAVORITES;
    const unique = favorites.filter((favorite, index, list) => favorite?.name && list.findIndex(item => favoriteKey(item?.name) === favoriteKey(favorite.name)) === index);
    if (stored && unique.length !== stored.length) saveFavorites(unique);
    return unique;
  } catch { return DEFAULT_FAVORITES; }
}

function saveFavorites(favorites) { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); }
function markUpdated() { updateStatus.textContent = `Letzte Aktualisierung: ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`; }
function favoriteKey(name) { return String(name || "").trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").toLocaleLowerCase("de-DE"); }
function hasFavorite(favorites, name) { return favorites.some(favorite => favoriteKey(favorite.name) === favoriteKey(name)); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])); }

function cacheKey(favorite) { return `${DEPARTURE_CACHE_PREFIX}${favorite.lid || favorite.locationName || favorite.name}`; }
function readDepartureCache(favorite) {
  try { const cached = JSON.parse(localStorage.getItem(cacheKey(favorite))); return cached?.departures?.length ? cached : null; } catch { return null; }
}
function writeDepartureCache(favorite, departures) {
  try { localStorage.setItem(cacheKey(favorite), JSON.stringify({ savedAt: Date.now(), departures })); } catch { /* Speicher kann blockiert sein. */ }
}
function friendlyError(error, fallback = "Die Daten sind momentan nicht verfügbar.") {
  if (!navigator.onLine) return "Keine Internetverbindung. Bitte später erneut versuchen.";
  if (error?.name === "TypeError") return "Verbindung zur KVB konnte nicht hergestellt werden.";
  return error?.message || fallback;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const button = document.getElementById("toggleTheme");
  button.innerHTML = theme === "dark" ? '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>' : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.3A8 8 0 0 1 8.7 4 8.5 8.5 0 1 0 20 15.3Z"></path></svg>';
  button.setAttribute("aria-label", theme === "dark" ? "Hellen Modus aktivieren" : "Dark Mode aktivieren");
}

async function getDepartures(favorite) {
  updateStatus.textContent = "Aktualisiere …";
  const params = favorite.lid ? `lid=${encodeURIComponent(favorite.lid)}` : `name=${encodeURIComponent(favorite.locationName || favorite.name)}`;
  try {
    const response = await fetch(`api/departures.php?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Abfahrten sind momentan nicht verfügbar.");
    const departures = data.departures.slice(0, 9);
    writeDepartureCache(favorite, departures);
    markUpdated();
    return departures;
  } catch (error) {
    const cached = readDepartureCache(favorite);
    if (cached) {
      const age = Math.max(1, Math.round((Date.now() - cached.savedAt) / 60000));
      updateStatus.textContent = `Offline · letzter Stand vor ${age} Min.`;
      const departures = cached.departures.slice(0, 9);
      departures.fromCache = true;
      return departures;
    }
    throw new Error(friendlyError(error));
  }
}

function departureMarkup(departures, favoriteName = "") {
  if (!departures.length) return `<p class="empty-copy">Keine Abfahrten gefunden.</p>`;
  const directions = [...new Set(departures.map(item => item.direction).filter(Boolean))];
  const selectedDirection = directionFilters.get(favoriteName) || "all";
  const visibleDepartures = selectedDirection === "all" ? departures : departures.filter(item => item.direction === selectedDirection);
  const displayedDepartures = expandedDepartures.has(favoriteName) ? visibleDepartures : visibleDepartures.slice(0, 4);
  const directionMarkup = directions.length > 1 ? `<div class="departure-tools"><div class="direction-filters" role="group" aria-label="Richtung auswählen"><button type="button" class="direction-filter ${selectedDirection === "all" ? "is-active" : ""}" data-direction="all">Alle</button>${directions.map(direction => `<button type="button" class="direction-filter ${selectedDirection === direction ? "is-active" : ""}" data-direction="${escapeHtml(direction)}">${escapeHtml(direction)}</button>`).join("")}</div><button type="button" class="share-stop">Teilen</button></div>` : `<div class="share-row"><button type="button" class="share-stop">Teilen</button></div>`;
  const cacheNotice = departures.fromCache ? `<p class="cache-notice">Letzter bekannter Stand – Aktualisierung momentan nicht möglich.</p>` : "";
  if (!visibleDepartures.length) return `${directionMarkup}${cacheNotice}<p class="empty-copy">Keine Abfahrten für diese Richtung.</p>`;
  const moreButton = visibleDepartures.length > 4 ? `<button type="button" class="more-departures">${expandedDepartures.has(favoriteName) ? "Weniger anzeigen" : `+ ${visibleDepartures.length - 4} weitere`}</button>` : "";
  return `${directionMarkup}${cacheNotice}<div class="departures">${displayedDepartures.map(departure => {
    const departureDate = new Date(departure.time);
    const time = departureDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const minutes = Math.max(0, Math.round((departureDate.getTime() - Date.now()) / 60000));
    const relative = minutes === 0 ? "jetzt" : `in ${minutes} Min.`;
    const status = departure.realtime ? "Echtzeit" : "Fahrplan";
    const delay = departure.delayMinutes ? `<em class="delay-badge">+${departure.delayMinutes} Min.</em>` : "";
    const platform = departure.platform ? ` · Gleis ${escapeHtml(departure.platform)}` : "";
    const type = /^\d+$/.test(departure.line) && Number(departure.line) < 100 ? "tram" : "bus";
    return `<div class="departure"><span class="line-badge line-badge--${type}">${escapeHtml(departure.line)}</span><span class="departure-info"><strong class="departure-countdown">${relative}</strong><span class="departure-detail">${escapeHtml(departure.direction)}${platform} · ${status}</span></span><span class="departure-time">${time}</span>${delay}</div>`;
  }).join("")}</div>${moreButton}`;
}

function renderFavorite(favorite, index) {
  const item = document.createElement("article");
  item.className = "stop-item";
  item.innerHTML = `<button class="stop-button" type="button" aria-expanded="false"><span class="stop-copy"><span class="stop-name">${escapeHtml(favorite.name)}</span><span class="stop-meta">${escapeHtml(favorite.locationName || "Köln")}</span></span><span class="chevron">›</span></button><div class="departure-slot"></div>`;
  item.querySelector(".stop-button").addEventListener("click", async () => {
    const slot = item.querySelector(".departure-slot");
    const button = item.querySelector(".stop-button");
    if (slot.classList.contains("is-open")) {
      slot.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      openFavorites.delete(favorite.name);
      return;
    }

    document.querySelectorAll(".stop-item .departure-slot.is-open").forEach(openSlot => {
      openSlot.classList.remove("is-open");
      const openButton = openSlot.previousElementSibling;
      openButton?.setAttribute("aria-expanded", "false");
    });
    openFavorites.clear();
    button.setAttribute("aria-expanded", "true");
    slot.classList.add("is-open");
    slot.innerHTML = `<p class="empty-copy">Abfahrten werden geladen …</p>`;
    openFavorites.set(favorite.name, { favorite, slot });
    try { const departures = await getDepartures(favorite); const entry = openFavorites.get(favorite.name); if (entry) entry.departures = departures; slot.innerHTML = departureMarkup(departures, favorite.name); bindDepartureActions(slot, favorite); } catch (error) { slot.innerHTML = `<p class="empty-copy">${escapeHtml(friendlyError(error))}</p><button class="retry-button" type="button">Erneut versuchen</button>`; slot.querySelector(".retry-button").addEventListener("click", () => button.click()); }
  });
  favoriteList.appendChild(item);
}

function bindDepartureActions(slot, favorite) {
  slot.querySelectorAll(".direction-filter").forEach(button => button.addEventListener("click", () => {
    directionFilters.set(favorite.name, button.dataset.direction);
    const entry = openFavorites.get(favorite.name);
    if (entry?.departures || favorite.departures) { slot.innerHTML = departureMarkup(entry?.departures || favorite.departures, favorite.name); bindDepartureActions(slot, favorite); }
  }));
  slot.querySelector(".more-departures")?.addEventListener("click", () => {
    if (expandedDepartures.has(favorite.name)) expandedDepartures.delete(favorite.name);
    else expandedDepartures.add(favorite.name);
    const entry = openFavorites.get(favorite.name);
    if (entry?.departures) { slot.innerHTML = departureMarkup(entry.departures, favorite.name); bindDepartureActions(slot, favorite); }
    else if (favorite.departures) { slot.innerHTML = departureMarkup(favorite.departures, favorite.name); bindDepartureActions(slot, favorite); }
  });
  slot.querySelector(".share-stop")?.addEventListener("click", async () => {
    const shareUrl = `${location.origin}${location.pathname}?stop=${encodeURIComponent(favorite.name)}`;
    const shareData = { title: "KVB Abfahrten", text: `Abfahrten an ${favorite.name}`, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(`${shareData.text}: ${shareUrl}`);
      slot.querySelector(".share-stop").textContent = "Kopiert ✓";
    } catch { /* Teilen wurde abgebrochen. */ }
  });
}

async function loadSharedStop(name) {
  const panel = document.getElementById("sharedStopPanel");
  const content = document.getElementById("sharedStopContent");
  const favorite = { name, locationName: `Köln ${name}` };
  panel.hidden = false;
  document.getElementById("sharedStopName").textContent = name;
  content.innerHTML = `<p class="empty-copy">Abfahrten werden geladen …</p>`;
  try {
    const departures = await getDepartures(favorite);
    favorite.departures = departures;
    content.innerHTML = departureMarkup(departures, name);
    bindDepartureActions(content, favorite);
  } catch (error) { content.innerHTML = `<p class="empty-copy">${escapeHtml(friendlyError(error))}</p>`; }
}

document.getElementById("closeSharedStop").addEventListener("click", () => {
  document.getElementById("sharedStopPanel").hidden = true;
  const url = new URL(window.location.href);
  url.searchParams.delete("stop");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
});

function renderFavorites() { favoriteList.innerHTML = ""; loadFavorites().forEach(renderFavorite); markUpdated(); }

async function loadDisruptions() {
  const list = document.getElementById("disruptionList");
  try {
    const response = await fetch("api/disruptions.php", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Nicht verfügbar");
    list.innerHTML = data.items.length ? data.items.slice(0, 5).map(item => `<article class="disruption-item"><span class="line-badge line-badge--tram">${escapeHtml(item.line)}</span><p>${escapeHtml(item.text)}</p></article>`).join("") : `<p class="empty-copy">Keine aktuellen Störungen.</p>`;
    document.getElementById("disruptionStatus").textContent = `Stand ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) { list.innerHTML = `<p class="empty-copy">${escapeHtml(friendlyError(error, "Störungsmeldungen momentan nicht verfügbar."))}</p><button class="retry-button" type="button" id="retryDisruptions">Erneut versuchen</button>`; document.getElementById("retryDisruptions").addEventListener("click", loadDisruptions); document.getElementById("disruptionStatus").textContent = "Nicht verfügbar"; }
}

function openFavoriteByName(name) {
  const favorite = loadFavorites().find(item => item.name === name);
  if (!favorite) return;
  const buttons = [...favoriteList.querySelectorAll(".stop-button")];
  const button = buttons.find(item => item.querySelector(".stop-name")?.textContent === name);
  button?.click();
}

async function searchStops(query) {
  const response = await fetch(`api/stops.php?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Suche nicht verfügbar");
  return data.stops;
}

function showSearchResults(stops) {
  searchResults.hidden = false;
  const favorites = loadFavorites();
  searchResults.innerHTML = stops.length ? stops.map(stop => { const saved = hasFavorite(favorites, stop.name); return `<button class="search-result${saved ? " is-saved" : ""}" type="button" data-name="${escapeHtml(stop.name)}" ${saved ? "disabled" : ""}><span><strong>${escapeHtml(stop.name)}</strong><br><small>${saved ? "Bereits gespeichert" : "KVB-Haltestelle"}</small></span><span class="chevron">${saved ? "✓" : "＋"}</span></button>`; }).join("") : `<p class="empty-copy">Keine Haltestelle gefunden.</p>`;
  searchResults.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    const stop = stops.find(item => item.name === button.dataset.name);
    const favorites = loadFavorites();
    if (!hasFavorite(favorites, stop.name)) { favorites.unshift({ name: stop.name, locationName: `Köln ${stop.name}` }); saveFavorites(favorites); }
    searchResults.hidden = true; document.getElementById("stopSearch").value = ""; renderFavorites();
  }));
}

let searchTimer;
document.getElementById("stopSearch").addEventListener("input", event => {
  clearTimeout(searchTimer);
  const query = event.target.value.trim();
  if (query.length < 2) { searchResults.hidden = true; return; }
  searchTimer = setTimeout(async () => {
    searchResults.hidden = false; searchResults.innerHTML = `<p class="empty-copy">Suche läuft …</p>`;
    try { showSearchResults(await searchStops(query)); } catch (error) { searchResults.innerHTML = `<p class="empty-copy">${escapeHtml(friendlyError(error, "Suche momentan nicht verfügbar."))}</p><button class="retry-button" type="button" id="retrySearch">Erneut versuchen</button>`; document.getElementById("retrySearch")?.addEventListener("click", () => document.getElementById("stopSearch").dispatchEvent(new Event("input"))); }
  }, 260);
});

document.getElementById("toggleSearch").addEventListener("click", () => {
  const panel = document.getElementById("stopSearchForm");
  const open = panel.classList.toggle("is-collapsed") === false;
  document.getElementById("toggleSearch").setAttribute("aria-expanded", String(open));
  if (open) document.getElementById("stopSearch").focus();
  else searchResults.hidden = true;
});
document.getElementById("stopSearchForm").addEventListener("submit", async event => { event.preventDefault(); const query = document.getElementById("stopSearch").value.trim(); if (query.length < 2) return; searchResults.hidden = false; searchResults.innerHTML = `<p class="empty-copy">Suche läuft …</p>`; try { showSearchResults(await searchStops(query)); } catch (error) { searchResults.innerHTML = `<p class="empty-copy">${escapeHtml(friendlyError(error, "Haltestellen konnten nicht gesucht werden."))}</p>`; } });
document.getElementById("refreshAll").addEventListener("click", () => {
  const button = document.getElementById("refreshAll");
  button.classList.remove("is-refreshing"); void button.offsetWidth; button.classList.add("is-refreshing");
  renderFavorites();
});
document.getElementById("sheetAdd").addEventListener("click", () => { document.getElementById("manageDialog").close(); const panel = document.getElementById("stopSearchForm"); panel.classList.remove("is-collapsed"); document.getElementById("toggleSearch").setAttribute("aria-expanded", "true"); document.getElementById("stopSearch").focus(); });
function renderManageList() {
  const list = document.getElementById("manageList");
  list.innerHTML = loadFavorites().map((favorite, index) => `<div class="manage-row" draggable="true" data-index="${index}"><span class="manage-name">${escapeHtml(favorite.name)}</span><span class="manage-actions"><button type="button" class="rename-button" data-rename="${index}" data-index="${index}" aria-label="${escapeHtml(favorite.name)} umbenennen"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16-.8 4.8L8 20l10.7-10.7-4-4L4 16Z"></path><path d="m13.5 6.5 4 4"></path></svg></button><button type="button" data-move="up" data-index="${index}" aria-label="${escapeHtml(favorite.name)} nach oben"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 11 6-6 6 6"></path><path d="M12 5v14"></path></svg></button><button type="button" data-move="down" data-index="${index}" aria-label="${escapeHtml(favorite.name)} nach unten"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 13 6 6 6-6"></path><path d="M12 19V5"></path></svg></button><button type="button" class="remove-button" data-remove="${index}" aria-label="${escapeHtml(favorite.name)} entfernen"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M10 11v6M14 11v6"></path><path d="m6 7 1 13h10l-1-13"></path><path d="M9 7V4h6v3"></path></svg></button></span></div>`).join("");
  list.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    const favorites = loadFavorites(); const index = Number(button.dataset.index);
    if (button.dataset.rename !== undefined) { const name = window.prompt("Name der Haltestelle", favorites[index].name)?.trim(); if (name && !hasFavorite(favorites, name)) { favorites[index].name = name; saveFavorites(favorites); renderFavorites(); renderManageList(); } return; }
    if (button.dataset.remove !== undefined) favorites.splice(index, 1);
    if (button.dataset.move === "up" && index > 0) [favorites[index - 1], favorites[index]] = [favorites[index], favorites[index - 1]];
    if (button.dataset.move === "down" && index < favorites.length - 1) [favorites[index + 1], favorites[index]] = [favorites[index], favorites[index + 1]];
    saveFavorites(favorites); renderFavorites(); renderManageList();
  }));
  list.querySelectorAll(".manage-row").forEach(row => {
    row.addEventListener("dragstart", event => { row.classList.add("is-dragging"); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", row.dataset.index); });
    row.addEventListener("dragend", () => row.classList.remove("is-dragging"));
    row.addEventListener("dragover", event => { event.preventDefault(); row.classList.add("is-drag-target"); });
    row.addEventListener("dragleave", () => row.classList.remove("is-drag-target"));
    row.addEventListener("drop", event => {
      event.preventDefault(); row.classList.remove("is-drag-target");
      const from = Number(event.dataTransfer.getData("text/plain")); const to = Number(row.dataset.index);
      if (from === to || Number.isNaN(from) || Number.isNaN(to)) return;
      const favorites = loadFavorites(); const [moved] = favorites.splice(from, 1); favorites.splice(to, 0, moved); saveFavorites(favorites); renderFavorites(); renderManageList();
    });
  });
}
document.getElementById("manageFavorites").addEventListener("click", () => {
  renderManageList();
  document.getElementById("manageDialog").showModal();
});
document.getElementById("findNearby").addEventListener("click", () => {
  if (!navigator.geolocation) { document.getElementById("nearbyMessage").textContent = "Standort wird von diesem Browser nicht unterstützt."; return; }
  document.getElementById("nearbyMessage").textContent = "Nahe Haltestellen werden gesucht …";
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const response = await fetch(`api/nearby.php?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      document.getElementById("nearbyMessage").textContent = `${data.stops.length} Haltestellen in deiner Nähe`;
      const nearbyFavorites = loadFavorites();
      const list = document.getElementById("nearbyList"); list.innerHTML = data.stops.map(stop => { const saveButton = hasFavorite(nearbyFavorites, stop.name) ? "" : `<button class="nearby-save" type="button" data-name="${escapeHtml(stop.name)}" aria-label="${escapeHtml(stop.name)} als Favorit speichern">☆</button>`; return `<div class="nearby-row"><button class="nearby-result" type="button" data-name="${escapeHtml(stop.name)}"><strong>${escapeHtml(stop.name)}</strong><span>${Math.round(stop.distance)} m</span></button>${saveButton}</div>`; }).join("") + `<div id="nearbyDepartures" class="nearby-departures" hidden></div>`;
      list.querySelectorAll(".nearby-result").forEach(button => button.addEventListener("click", () => {
        const name = button.dataset.name;
        const nearbyDepartures = document.getElementById("nearbyDepartures");
        nearbyDepartures.hidden = false;
        nearbyDepartures.innerHTML = `<h3>${escapeHtml(name)}</h3><p class="empty-copy">Abfahrten werden geladen …</p>`;
        getDepartures({ name, locationName: `Köln ${name}` }).then(departures => {
          nearbyDepartures.innerHTML = `<h3>${escapeHtml(name)}</h3>${departureMarkup(departures)}`;
        }).catch(error => {
          nearbyDepartures.innerHTML = `<h3>${escapeHtml(name)}</h3><p class="empty-copy">${escapeHtml(friendlyError(error))}</p>`;
        });
        nearbyDepartures.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }));
      list.querySelectorAll(".nearby-save").forEach(button => button.addEventListener("click", () => {
        const name = button.dataset.name; const favorites = loadFavorites();
        if (!hasFavorite(favorites, name)) { favorites.unshift({ name, locationName: `Köln ${name}` }); saveFavorites(favorites); renderFavorites(); }
        button.textContent = "★"; button.classList.add("is-saved");
      }));
    } catch (error) { document.getElementById("nearbyMessage").textContent = friendlyError(error, "Haltestellen in deiner Nähe konnten nicht geladen werden."); }
  }, () => { document.getElementById("nearbyMessage").textContent = "Standortzugriff wurde nicht erlaubt."; }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
});

renderFavorites();

const sharedStop = new URLSearchParams(location.search).get("stop");
if (sharedStop) loadSharedStop(sharedStop);

setTheme(localStorage.getItem(THEME_KEY) || "light");
document.getElementById("toggleTheme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

let disruptionsLoaded = false;
document.getElementById("toggleDisruptions").addEventListener("click", async () => {
  const panel = document.getElementById("disruptionPanel");
  const button = document.getElementById("toggleDisruptions");
  const open = panel.hidden;
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Ausblenden" : "Anzeigen";
  if (open && !disruptionsLoaded) { disruptionsLoaded = true; await loadDisruptions(); }
});

setInterval(async () => {
  for (const entry of openFavorites.values()) {
    try { entry.slot.innerHTML = departureMarkup(await getDepartures(entry.favorite)); } catch { /* Die letzte Anzeige bleibt sichtbar. */ }
  }
}, 60000);

setInterval(() => {
  for (const entry of openFavorites.values()) {
    if (entry.departures) { entry.slot.innerHTML = departureMarkup(entry.departures, entry.favorite.name); bindDepartureActions(entry.slot, entry.favorite); }
  }
}, 15000);
