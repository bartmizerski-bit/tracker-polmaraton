// Widok szczegółów pojedynczego dnia — używany zarówno przez zakładkę
// "Dziś", jak i przez widok "Tydzień" (dla wybranego dnia w tygodniu).
import {
  CATEGORY_LABELS,
  cycleTristate,
  getPlanDay,
  getRealizacja,
} from "../state.js";

function formatujDate(dateKey) {
  const d = new Date(dateKey);
  const tekst = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

function komentarzDnia(realizacja) {
  if (realizacja.stan_dnia === "przerwa") return "Dzień przerwy. Kolana dziękują.";
  if (realizacja.stan_dnia === "len") return "No i git, przynajmniej szczerze.";
  return "Odhacz, co się da.";
}

function renderujKafelek(kategoria, planDay, realizacja) {
  const dane = planDay[kategoria];
  if (!dane) return ""; // brak wpisu = brak treningu tej kategorii tego dnia

  const stanCheck = realizacja.kategorie?.[kategoria] ?? "niezrealizowany";
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

export function mount(container, dateKey) {
  const planDay = getPlanDay(dateKey);
  const realizacja = getRealizacja(dateKey);

  function render() {
    const daystateButtons = `
      <div class="day-state-controls">
        <button class="day-state-btn ${realizacja.stan_dnia === "przerwa" ? "active-przerwa" : ""}" data-action="day-state" data-value="przerwa">Przerwa</button>
        <button class="day-state-btn ${realizacja.stan_dnia === "len" ? "active-len" : ""}" data-action="day-state" data-value="len">Leń</button>
      </div>
    `;

    const fixedRow = `
      <div class="fixed-row">
        <div class="fixed-item">
          <label for="km-input-${dateKey}">Marsz</label>
          <input id="km-input-${dateKey}" class="km-input" type="number" step="0.1" min="0"
                 placeholder="km" value="${realizacja.km_marsz.wartosc}" data-field="km-marsz" />
          <button class="checkbox-binary ${realizacja.km_marsz.potwierdzone ? "checked" : ""}"
                  data-action="km-potwierdzenie" aria-label="Potwierdź marsz"></button>
        </div>
        <div class="fixed-divider"></div>
        <div class="fixed-item">
          <label>Trzymanie michy</label>
          <button class="checkbox-binary ${realizacja.trzymanie_michy ? "checked" : ""}"
                  data-action="trzymanie-michy" aria-label="Trzymanie michy"></button>
        </div>
      </div>
    `;

    let glownaTresc;
    if (realizacja.stan_dnia === "normalny") {
      const kafelki = Object.keys(CATEGORY_LABELS)
        .map((k) => renderujKafelek(k, planDay, realizacja))
        .join("");
      glownaTresc = kafelki.trim()
        ? kafelki
        : `<div class="day-off-message">Brak treningu w planie na ten dzień.</div>`;
    } else {
      const wiadomosc =
        realizacja.stan_dnia === "przerwa"
          ? "Dzień oznaczony jako przerwa. Treningi dziś się nie liczą."
          : "Dzień oznaczony jako leń. Bywa. Jutro nowe rozdanie.";
      glownaTresc = `<div class="day-off-message">${wiadomosc}</div>`;
    }

    container.innerHTML = `
      <div class="topbar">
        <span class="data">${formatujDate(dateKey)}</span>
        <span class="komentarz">${komentarzDnia(realizacja)}</span>
      </div>
      ${daystateButtons}
      ${fixedRow}
      ${glownaTresc}
    `;
  }

  container.onclick = (event) => {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    if (action === "tristate") {
      const kat = el.dataset.category;
      realizacja.kategorie[kat] = cycleTristate(realizacja.kategorie[kat] ?? "niezrealizowany");
    } else if (action === "km-potwierdzenie") {
      realizacja.km_marsz.potwierdzone = !realizacja.km_marsz.potwierdzone;
    } else if (action === "trzymanie-michy") {
      realizacja.trzymanie_michy = !realizacja.trzymanie_michy;
    } else if (action === "day-state") {
      const wartosc = el.dataset.value;
      realizacja.stan_dnia = realizacja.stan_dnia === wartosc ? "normalny" : wartosc;
    }
    render();
  };

  container.oninput = (event) => {
    if (event.target.dataset.field === "km-marsz") {
      realizacja.km_marsz.wartosc = event.target.value;
    }
  };

  render();
}
