// Widok szczegółów pojedynczego dnia — używany zarówno przez zakładkę
// "Dziś", jak i przez widok "Tydzień" (dla wybranego dnia w tygodniu).
import {
  CATEGORY_LABELS,
  cycleTristate,
  getPlanDay,
  getRealizacja,
  zapiszRealizacje,
  mockWpisyWagi,
  mockProfil,
  toKey,
  addDays,
} from "../state.js";
import { createTimerWidget } from "../timer.js";

const KCAL_NA_KG_NA_KM = 0.9; // przybliżony koszt energetyczny marszu

// Gest przesunięcia dnia
const PROG_SWIPE = 50; // minimalny dystans poziomy w px
const STREFA_KRAWEDZI = 30; // margines ekranu ignorowany (gest cofania w Safari)

// Przesuwa klucz daty o n dni. Parsujemy ręcznie, bo new Date("2026-08-06")
// jest interpretowane jako północ UTC — w innej strefie potrafi cofnąć dzień.
function przesunKlucz(dateKey, n) {
  const [rok, mies, dzien] = dateKey.split("-").map(Number);
  return toKey(addDays(new Date(rok, mies - 1, dzien), n));
}

function ostatniaWaga() {
  if (!mockWpisyWagi.length) return null;
  const posortowane = [...mockWpisyWagi].sort((a, b) => (a.data > b.data ? 1 : -1));
  return posortowane[posortowane.length - 1].waga_kg;
}

function kalorieMarszu(km) {
  const waga = ostatniaWaga();
  if (!waga || !km || isNaN(km)) return 0;
  return Math.round(km * waga * KCAL_NA_KG_NA_KM);
}

function kalorieDnia(planDay, realizacja) {
  let suma = 0;
  ["bieganie", "drazki", "dom"].forEach((kat) => {
    const dane = planDay[kat];
    const stan = realizacja.kategorie?.[kat];
    if (dane?.kalorie && (stan === "zrealizowany" || stan === "czesciowo")) {
      suma += dane.kalorie;
    }
  });
  suma += kalorieMarszu(parseFloat(realizacja.km_marsz.wartosc));
  return suma;
}

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

// ---------------------------------------------------------------------
// Bieganie — trening rozpisany na segmenty.
//
// Struktura z planu:
//   segmenty: [
//     { nazwa, czas_min?, dystans_km?, tempo?, strefa_tetna?, zakres_tetna?, opis? },
//     { powtorzenia: N, czesci: [ segment prosty, ... ] }
//   ]
// Bieg ciągły = jeden segment prosty. Interwały = blok z "powtorzenia".
// Łączny czas liczy aplikacja, nie AI.
// ---------------------------------------------------------------------

function formatujMinuty(min) {
  if (!min) return "";
  const calkowite = Math.round(min);
  if (calkowite < 60) return `${calkowite} min`;
  const h = Math.floor(calkowite / 60);
  const m = calkowite % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatujKm(km) {
  if (!km) return "";
  return `${Number(Number(km).toFixed(1))} km`;
}

function miaraTekst(min, km) {
  return [formatujMinuty(min), formatujKm(km)].filter(Boolean).join(" · ");
}

// Sumuje czas i dystans pojedynczego segmentu (z uwzględnieniem powtórzeń).
function sumaSegmentu(segment) {
  if (Array.isArray(segment.czesci)) {
    const powtorzenia = Number(segment.powtorzenia) || 1;
    return segment.czesci.reduce(
      (acc, czesc) => ({
        min: acc.min + powtorzenia * (Number(czesc.czas_min) || 0),
        km: acc.km + powtorzenia * (Number(czesc.dystans_km) || 0),
      }),
      { min: 0, km: 0 }
    );
  }
  return { min: Number(segment.czas_min) || 0, km: Number(segment.dystans_km) || 0 };
}

function sumaTreningu(segmenty) {
  return segmenty.reduce(
    (acc, s) => {
      const { min, km } = sumaSegmentu(s);
      return { min: acc.min + min, km: acc.km + km };
    },
    { min: 0, km: 0 }
  );
}

function metaSegmentu(segment) {
  const czesci = [];
  if (segment.tempo) czesci.push(`<span>Tempo: <strong>${segment.tempo}</strong></span>`);
  if (segment.strefa_tetna || segment.zakres_tetna) {
    const etykieta = segment.strefa_tetna || "Tętno";
    const wartosc = segment.zakres_tetna || "—";
    czesci.push(`<span>${etykieta}: <strong>${wartosc}</strong></span>`);
  }
  if (!czesci.length) return "";
  return `<div class="segment-meta">${czesci.join("")}</div>`;
}

function renderujSegmentProsty(segment) {
  const miara = miaraTekst(Number(segment.czas_min) || 0, Number(segment.dystans_km) || 0);
  return `
    <li class="segment">
      <div class="segment-glowa">
        <span class="segment-nazwa">${segment.nazwa || "Bieg"}</span>
        ${miara ? `<span class="segment-miara">${miara}</span>` : ""}
      </div>
      ${metaSegmentu(segment)}
      ${segment.opis ? `<p class="segment-opis">${segment.opis}</p>` : ""}
    </li>
  `;
}

function renderujBlokPowtarzany(segment) {
  const powtorzenia = Number(segment.powtorzenia) || 1;
  const { min, km } = sumaSegmentu(segment);
  const miara = miaraTekst(min, km);
  const wnetrze = segment.czesci.map(renderujSegmentProsty).join("");

  return `
    <li class="segment-blok">
      <div class="blok-glowa">
        <span class="blok-powtorzenia">${powtorzenia} ×</span>
        ${miara ? `<span class="blok-miara">łącznie ${miara}</span>` : ""}
      </div>
      <ul class="segment-lista wciecie">${wnetrze}</ul>
    </li>
  `;
}

function renderujBieganie(dane) {
  const segmenty = Array.isArray(dane.segmenty) ? dane.segmenty : null;

  // Stary format planu (bez segmentów) — renderuj jak dotychczas,
  // żeby wcześniej zaimportowany plan nie przestał nagle działać.
  if (!segmenty || !segmenty.length) {
    return `
      <div class="tile-body">
        ${dane.opis ? `<p class="opis">${dane.opis}</p>` : ""}
        <div class="tile-meta">
          ${dane.tempo ? `<span>Tempo: <strong>${dane.tempo}</strong></span>` : ""}
          ${dane.zakres_tetna ? `<span>${dane.strefa_tetna || "Tętno"}: <strong>${dane.zakres_tetna}</strong></span>` : ""}
          ${dane.kalorie ? `<span>Kalorie: <strong>${dane.kalorie} kcal</strong></span>` : ""}
        </div>
        <p class="segment-opis">Ten trening pochodzi ze starszego importu — bez rozpisania na segmenty.</p>
      </div>
    `;
  }

  const suma = sumaTreningu(segmenty);
  const dystansCalkowity = Number(dane.dystans_km) || suma.km;
  const podsumowanie = miaraTekst(suma.min, dystansCalkowity);

  const lista = segmenty
    .map((s) => (Array.isArray(s.czesci) ? renderujBlokPowtarzany(s) : renderujSegmentProsty(s)))
    .join("");

  return `
    <div class="tile-body">
      ${podsumowanie ? `<p class="bieg-podsumowanie">${podsumowanie}</p>` : ""}
      ${dane.opis ? `<p class="opis">${dane.opis}</p>` : ""}
      <ul class="segment-lista">${lista}</ul>
      ${dane.kalorie ? `<p class="kalorie-info">${dane.kalorie} kcal</p>` : ""}
    </div>
  `;
}

function renderujKafelek(kategoria, planDay, realizacja) {
  const dane = planDay[kategoria];
  if (!dane) return ""; // brak wpisu = brak treningu tej kategorii tego dnia

  const stanCheck = realizacja.kategorie?.[kategoria] ?? "niezrealizowany";
  let tresc = "";

  if (kategoria === "bieganie") {
    tresc = renderujBieganie(dane);
  } else if (kategoria === "drazki" || kategoria === "dom") {
    const pozycje = (dane.cwiczenia || [])
      .map((c) => `<li><span class="nazwa-cwiczenia">${c.nazwa}</span><span class="ilosc">${c.ilosc}</span></li>`)
      .join("");
    tresc = `
      <ul class="exercise-list">${pozycje}</ul>
      ${dane.kalorie ? `<p class="kalorie-info">${dane.kalorie} kcal</p>` : ""}
    `;
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

// onZmianaDnia — opcjonalny callback (nowyKluczDaty). Jeśli podany,
// widok obsługuje przesuwanie palcem w lewo/prawo, z animacją.
export function mount(container, dateKey, onZmianaDnia) {
  const planDay = getPlanDay(dateKey);
  const realizacja = getRealizacja(dateKey);
  const timerWidget = createTimerWidget(() => mockProfil.domyslny_timer_sek);

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
        </div>
        <div class="fixed-divider"></div>
        <div class="fixed-item">
          <label>Trzymanie michy</label>
          <button class="checkbox-binary ${realizacja.trzymanie_michy ? "checked" : ""}"
                  data-action="trzymanie-michy" aria-label="Trzymanie michy"></button>
        </div>
      </div>
    `;

    const kalorieCard = `
      <div class="kalorie-dzien">
        <span class="kalorie-wartosc">${kalorieDnia(planDay, realizacja)}</span>
        <span class="kalorie-etykieta">kcal dziś</span>
      </div>
    `;

    // Timer przerwy pokazujemy raz, nad pierwszym kafelkiem drążków/domu —
    // jeśli oba są w planie tego dnia, dzielą jeden wspólny przycisk.
    const pokazTimer = Boolean(planDay.drazki || planDay.dom);
    let wstawionoTimer = false;

    let glownaTresc;
    if (realizacja.stan_dnia === "normalny") {
      const kafelki = Object.keys(CATEGORY_LABELS)
        .map((k) => {
          const tile = renderujKafelek(k, planDay, realizacja);
          if (!tile) return "";
          if (pokazTimer && !wstawionoTimer && (k === "drazki" || k === "dom")) {
            wstawionoTimer = true;
            return timerWidget.html() + tile;
          }
          return tile;
        })
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
      <div class="dzien-widok">
        <div class="topbar">
          <span class="data">${formatujDate(dateKey)}</span>
          <span class="komentarz">${komentarzDnia(realizacja)}</span>
        </div>
        ${daystateButtons}
        ${fixedRow}
        ${kalorieCard}
        ${glownaTresc}
      </div>
    `;

    timerWidget.attach(container);
  }

  container.onclick = (event) => {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    if (action === "tristate") {
      const kat = el.dataset.category;
      realizacja.kategorie[kat] = cycleTristate(realizacja.kategorie[kat] ?? "niezrealizowany");
    } else if (action === "trzymanie-michy") {
      realizacja.trzymanie_michy = !realizacja.trzymanie_michy;
    } else if (action === "day-state") {
      const wartosc = el.dataset.value;
      realizacja.stan_dnia = realizacja.stan_dnia === wartosc ? "normalny" : wartosc;
    }
    render();
    zapiszRealizacje(dateKey);
  };

  container.oninput = (event) => {
    if (event.target.dataset.field === "km-marsz") {
      realizacja.km_marsz.wartosc = event.target.value;
      zapiszRealizacje(dateKey);
    }
  };

  // --- Przesuwanie dnia gestem, z animacją ---
  if (typeof onZmianaDnia === "function") {
    let startX = null;
    let startY = null;
    let przesuwanie = false;

    container.ontouchstart = (event) => {
      startX = null;
      przesuwanie = false;
      if (event.touches.length !== 1) return;
      // Gest zaczęty na polu formularza zostawiamy przeglądarce.
      if (event.target.closest("input, textarea, select")) return;

      const dotyk = event.touches[0];
      const przyKrawedzi =
        dotyk.clientX < STREFA_KRAWEDZI || dotyk.clientX > window.innerWidth - STREFA_KRAWEDZI;
      if (przyKrawedzi) return; // to gest cofania przeglądarki, nie nasz

      startX = dotyk.clientX;
      startY = dotyk.clientY;
    };

    container.ontouchmove = (event) => {
      if (startX === null) return;
      const dotyk = event.touches[0];
      const dx = dotyk.clientX - startX;
      const dy = dotyk.clientY - startY;

      if (!przesuwanie) {
        if (Math.abs(dx) < 10) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.5) {
          startX = null; // to był scroll w pionie — oddajemy gest przeglądarce
          return;
        }
        przesuwanie = true;
      }

      const panel = container.querySelector(".dzien-widok");
      if (panel) {
        panel.style.transition = "none";
        panel.style.transform = `translateX(${dx}px)`;
      }
    };

    container.ontouchend = (event) => {
      const panel = container.querySelector(".dzien-widok");

      if (startX === null || !przesuwanie) {
        startX = null;
        przesuwanie = false;
        return;
      }

      const dotyk = event.changedTouches[0];
      const dx = dotyk.clientX - startX;
      startX = null;
      przesuwanie = false;
      if (!panel) return;

      panel.style.transition = "transform 0.22s ease-out";

      if (Math.abs(dx) < PROG_SWIPE) {
        panel.style.transform = "translateX(0)";
        return;
      }

      const kierunekDni = dx < 0 ? 1 : -1;
      panel.style.transform = `translateX(${dx < 0 ? -100 : 100}%)`;
      panel.addEventListener(
        "transitionend",
        () => onZmianaDnia(przesunKlucz(dateKey, kierunekDni)),
        { once: true }
      );
    };

    container.ontouchcancel = () => {
      startX = null;
      przesuwanie = false;
      const panel = container.querySelector(".dzien-widok");
      if (panel) {
        panel.style.transition = "transform 0.22s ease-out";
        panel.style.transform = "translateX(0)";
      }
    };
  }

  render();
}
