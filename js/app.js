// ---------------------------------------------------------------------
// UWAGA: To jest wersja demonstracyjna z danymi na sztywno (mock),
// żeby dopracować wygląd i interakcje widoku "Dziś".
// Podpięcie prawdziwych danych z IndexedDB to kolejny krok.
// ---------------------------------------------------------------------

// Rejestracja service workera
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Rejestracja service workera nie powiodła się:", err);
    });
  });
}

// --- Przykładowy dzień z planu (taki format przychodzi z importu AI) ---
const mockPlanDay = {
  bieganie: {
    opis: "Interwały 2 min bieg / 3 min marsz, 6 powtórzeń",
    tempo: "5:30-6:00 min/km",
    strefa_tetna: "Strefa 2",
    zakres_tetna: "128-142 bpm",
  },
  drazki: {
    cwiczenia: [
      { nazwa: "Podciąganie nachwytem", ilosc: "4x6" },
      { nazwa: "Zwis aktywny", ilosc: "3x30s" },
    ],
  },
  sporty_walki: true,
  // "dom" celowo brak tego dnia — pokazuje regułę "brak wpisu = brak treningu"
};

const CATEGORY_LABELS = {
  bieganie: "Bieganie",
  drazki: "Drążki",
  dom: "Dom",
  sporty_walki: "Sporty walki",
};

const TRISTATE_ORDER = ["niezrealizowany", "czesciowo", "zrealizowany"];

// --- Stan realizacji (docelowo z IndexedDB, na razie w pamięci) ---
const state = {
  dayState: "normalny", // "normalny" | "przerwa" | "len"
  kmMarsz: { wartosc: "", potwierdzone: false },
  trzymanieMichy: false,
  kategorie: {
    bieganie: "niezrealizowany",
    drazki: "niezrealizowany",
    sporty_walki: "niezrealizowany",
  },
};

function cycleTristate(current) {
  const i = TRISTATE_ORDER.indexOf(current);
  return TRISTATE_ORDER[(i + 1) % TRISTATE_ORDER.length];
}

function formatujDate() {
  const d = new Date();
  const tekst = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

function komentarzDnia() {
  if (state.dayState === "przerwa") return "Dzień przerwy. Kolana dziękują.";
  if (state.dayState === "len") return "No i git, przynajmniej szczerze.";
  return "Odhacz, co się da.";
}

// --- Renderowanie pojedynczego kafelka kategorii ---
function renderujKafelek(kategoria) {
  const dane = mockPlanDay[kategoria];
  if (!dane) return ""; // brak wpisu = brak treningu tej kategorii dziś

  const stanCheck = state.kategorie[kategoria] ?? "niezrealizowany";
  let tresc = "";

  if (kategoria === "bieganie") {
    tresc = `
      <div class="tile-body">
        <p class="opis">${dane.opis}</p>
        <div class="tile-meta">
          <span>Tempo: <strong>${dane.tempo}</strong></span>
          <span>${dane.strefa_tetna}: <strong>${dane.zakres_tetna}</strong></span>
        </div>
      </div>
    `;
  } else if (kategoria === "drazki" || kategoria === "dom") {
    const pozycje = dane.cwiczenia
      .map((c) => `<li><span>${c.nazwa}</span><span class="ilosc">${c.ilosc}</span></li>`)
      .join("");
    tresc = `<ul class="exercise-list">${pozycje}</ul>`;
  }
  // sporty_walki / silownia: tylko checkbox, bez treści — tresc zostaje puste

  return `
    <div class="tile">
      <div class="tile-header">
        <button class="tristate" data-action="tristate" data-category="${kategoria}" data-state="${stanCheck}" aria-label="Stan realizacji: ${kategoria}"></button>
        <span class="tile-title">${CATEGORY_LABELS[kategoria]}</span>
      </div>
      ${tresc}
    </div>
  `;
}

// --- Główny render ---
function render() {
  const app = document.getElementById("app");

  const daystateButtons = `
    <div class="day-state-controls">
      <button class="day-state-btn ${state.dayState === "przerwa" ? "active-przerwa" : ""}" data-action="day-state" data-value="przerwa">Przerwa</button>
      <button class="day-state-btn ${state.dayState === "len" ? "active-len" : ""}" data-action="day-state" data-value="len">Leń</button>
    </div>
  `;

  const fixedRow = `
    <div class="fixed-row">
      <div class="fixed-item">
        <label for="km-input">Marsz</label>
        <input id="km-input" class="km-input" type="number" step="0.1" min="0"
               placeholder="km" value="${state.kmMarsz.wartosc}" data-field="km-marsz" />
        <button class="checkbox-binary ${state.kmMarsz.potwierdzone ? "checked" : ""}"
                data-action="km-potwierdzenie" aria-label="Potwierdź marsz"></button>
      </div>
      <div class="fixed-divider"></div>
      <div class="fixed-item">
        <label>Trzymanie michy</label>
        <button class="checkbox-binary ${state.trzymanieMichy ? "checked" : ""}"
                data-action="trzymanie-michy" aria-label="Trzymanie michy"></button>
      </div>
    </div>
  `;

  let glownaTresc;
  if (state.dayState === "normalny") {
    glownaTresc = Object.keys(CATEGORY_LABELS)
      .map(renderujKafelek)
      .join("");
  } else {
    const wiadomosc =
      state.dayState === "przerwa"
        ? "Dzień oznaczony jako przerwa. Treningi dziś się nie liczą."
        : "Dzień oznaczony jako leń. Bywa. Jutro nowe rozdanie.";
    glownaTresc = `<div class="day-off-message">${wiadomosc}</div>`;
  }

  app.innerHTML = `
    <div class="topbar">
      <span class="data">${formatujDate()}</span>
      <span class="komentarz">${komentarzDnia()}</span>
    </div>
    ${daystateButtons}
    ${fixedRow}
    ${glownaTresc}
  `;
}

// --- Obsługa kliknięć (delegacja na stałym #app) ---
document.getElementById("app").addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;

  const action = el.dataset.action;

  if (action === "tristate") {
    const kat = el.dataset.category;
    state.kategorie[kat] = cycleTristate(state.kategorie[kat]);
  } else if (action === "km-potwierdzenie") {
    state.kmMarsz.potwierdzone = !state.kmMarsz.potwierdzone;
  } else if (action === "trzymanie-michy") {
    state.trzymanieMichy = !state.trzymanieMichy;
  } else if (action === "day-state") {
    const wartosc = el.dataset.value;
    state.dayState = state.dayState === wartosc ? "normalny" : wartosc;
  }

  render();
});

// Osobny listener na wpisywanie km marszu (input, nie click)
document.getElementById("app").addEventListener("input", (event) => {
  if (event.target.dataset.field === "km-marsz") {
    state.kmMarsz.wartosc = event.target.value;
  }
});

render();
