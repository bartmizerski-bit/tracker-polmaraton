// ---------------------------------------------------------------------
// Prawdziwe liczenie statystyk i odblokowań achievementów na podstawie
// zapisanej realizacji (mockRealizacja / IndexedDB) i planu.
//
// UPROSZCZENIE tego kroku: odblokowanie automatycznych achievementów
// liczy się na żywo przy każdym wejściu w widok, a nie jest zapisywane
// z datą odblokowania (jak przewiduje docelowy model danych). Wynik
// widoczny dla użytkownika jest ten sam, ale "data_odblokowania" nie
// jest jeszcze nigdzie trwale zapisywana — to naturalne rozszerzenie
// na kolejny krok, jeśli będzie potrzebne (np. do sortowania po dacie).
// ---------------------------------------------------------------------
import { mockRealizacja, mockPlan, mockProfil, mockWpisyWagi, toKey, addDays } from "./state.js";

const KCAL_NA_KG_NA_KM = 0.9; // przybliżony koszt energetyczny marszu — ta sama stała co w widoku dnia

function dzienZrealizowany(dateKey) {
  const realizacja = mockRealizacja[dateKey];
  const stanDnia = realizacja ? realizacja.stan_dnia : "normalny";

  if (stanDnia === "przerwa") return "neutralny";
  if (stanDnia === "len") return "porazka";

  const planDzien = mockPlan[dateKey] || {};
  const kategorieWPlanie = Object.keys(planDzien);
  if (kategorieWPlanie.length === 0) return "sukces"; // nic nie było zaplanowane tego dnia

  const kategorieRealizacji = realizacja ? realizacja.kategorie || {} : {};
  const wszystkieOdhaczone = kategorieWPlanie.every(
    (k) => kategorieRealizacji[k] === "zrealizowany" || kategorieRealizacji[k] === "czesciowo"
  );
  return wszystkieOdhaczone ? "sukces" : "porazka";
}

function zakresDat() {
  const dzisiaj = new Date();
  const startProfil = mockProfil.data_startu_planu ? new Date(mockProfil.data_startu_planu) : dzisiaj;
  const start = startProfil <= dzisiaj ? startProfil : dzisiaj;
  return { start, dzisiaj };
}

export function obliczPasse() {
  const { start, dzisiaj } = zakresDat();
  let biezaca = 0;
  let najdluzsza = 0;

  for (let dzien = start; dzien <= dzisiaj; dzien = addDays(dzien, 1)) {
    const wynik = dzienZrealizowany(toKey(dzien));
    if (wynik === "sukces") {
      biezaca += 1;
      if (biezaca > najdluzsza) najdluzsza = biezaca;
    } else if (wynik === "porazka") {
      biezaca = 0;
    }
    // "neutralny" (przerwa) — biezaca zostaje bez zmian
  }

  return { aktualna: biezaca, najdluzsza };
}

export function obliczSumeKm() {
  return Object.values(mockRealizacja).reduce((suma, dzien) => {
    const wartosc = parseFloat(dzien.km_marsz?.wartosc);
    return suma + (isNaN(wartosc) ? 0 : wartosc);
  }, 0);
}

export function obliczSesje() {
  const liczniki = {};
  Object.values(mockRealizacja).forEach((dzien) => {
    if (!dzien.kategorie) return;
    Object.entries(dzien.kategorie).forEach(([kat, stan]) => {
      if (stan === "zrealizowany" || stan === "czesciowo") {
        liczniki[kat] = (liczniki[kat] || 0) + 1;
      }
    });
  });
  return liczniki;
}

export function obliczRealizacjeTygodni(liczbaTygodni = 8) {
  const { dzisiaj } = zakresDat();
  const wyniki = [];

  for (let i = liczbaTygodni - 1; i >= 0; i--) {
    const koniecOkna = addDays(dzisiaj, -7 * i);
    let sukcesy = 0;
    let mianownik = 0;

    for (let cofniecie = 6; cofniecie >= 0; cofniecie--) {
      const dzien = addDays(koniecOkna, -cofniecie);
      if (dzien > dzisiaj) continue;
      const wynik = dzienZrealizowany(toKey(dzien));
      if (wynik === "neutralny") continue;
      mianownik += 1;
      if (wynik === "sukces") sukcesy += 1;
    }

    wyniki.push(mianownik ? Math.round((sukcesy / mianownik) * 100) : 0);
  }

  return wyniki;
}

// --- Trzymanie michy: osobny streak, niezależny od passy treningowej ---
export function obliczPasseMichy() {
  const { start, dzisiaj } = zakresDat();
  let biezaca = 0;
  let najdluzsza = 0;

  for (let dzien = start; dzien <= dzisiaj; dzien = addDays(dzien, 1)) {
    const realizacja = mockRealizacja[toKey(dzien)];
    if (realizacja && realizacja.trzymanie_michy) {
      biezaca += 1;
      if (biezaca > najdluzsza) najdluzsza = biezaca;
    } else {
      biezaca = 0;
    }
  }

  return { aktualna: biezaca, najdluzsza };
}

// --- Liczniki dni specjalnych ---
export function obliczDniPrzerwy() {
  return Object.values(mockRealizacja).filter((d) => d.stan_dnia === "przerwa").length;
}

export function obliczDniLen() {
  return Object.values(mockRealizacja).filter((d) => d.stan_dnia === "len").length;
}

// --- Suma spalonych kalorii (aktywność z planu + marsz) ---
function ostatniaWaga() {
  if (!mockWpisyWagi.length) return null;
  const posortowane = [...mockWpisyWagi].sort((a, b) => (a.data > b.data ? 1 : -1));
  return posortowane[posortowane.length - 1].waga_kg;
}

function kalorieZaDzien(dateKey) {
  const planDay = mockPlan[dateKey] || {};
  const realizacja = mockRealizacja[dateKey];
  if (!realizacja) return 0;

  let suma = 0;
  ["bieganie", "drazki", "dom"].forEach((kat) => {
    const dane = planDay[kat];
    const stan = realizacja.kategorie?.[kat];
    if (dane?.kalorie && (stan === "zrealizowany" || stan === "czesciowo")) {
      suma += dane.kalorie;
    }
  });

  const waga = ostatniaWaga();
  const km = parseFloat(realizacja.km_marsz?.wartosc);
  if (waga && km && !isNaN(km)) {
    suma += Math.round(km * waga * KCAL_NA_KG_NA_KM);
  }

  return suma;
}

export function obliczSumeKalorii() {
  return Object.keys(mockRealizacja).reduce((suma, dateKey) => suma + kalorieZaDzien(dateKey), 0);
}

// --- % zrealizowanych dni z całego planu (od startu do dziś, bez dni przerwy) ---
export function obliczProcentRealizacjiPlanu() {
  const { start, dzisiaj } = zakresDat();
  let sukcesy = 0;
  let mianownik = 0;

  for (let dzien = start; dzien <= dzisiaj; dzien = addDays(dzien, 1)) {
    const wynik = dzienZrealizowany(toKey(dzien));
    if (wynik === "neutralny") continue;
    mianownik += 1;
    if (wynik === "sukces") sukcesy += 1;
  }

  return mianownik ? Math.round((sukcesy / mianownik) * 100) : 0;
}

function sprawdzPowrotPoPrzerwie() {
  const { start, dzisiaj } = zakresDat();
  let poprzedniStanDnia = null;

  for (let dzien = start; dzien <= dzisiaj; dzien = addDays(dzien, 1)) {
    const key = toKey(dzien);
    const realizacja = mockRealizacja[key];
    const stanDnia = realizacja ? realizacja.stan_dnia : "normalny";

    if (poprzedniStanDnia === "przerwa" && dzienZrealizowany(key) === "sukces") {
      return true;
    }
    poprzedniStanDnia = stanDnia;
  }
  return false;
}

function sprawdzMiesiacBezLenia() {
  const { start, dzisiaj } = zakresDat();
  let seriaBezLenia = 0;

  for (let dzien = start; dzien <= dzisiaj; dzien = addDays(dzien, 1)) {
    const realizacja = mockRealizacja[toKey(dzien)];
    const stanDnia = realizacja ? realizacja.stan_dnia : "normalny";

    if (stanDnia === "len") {
      seriaBezLenia = 0;
    } else {
      seriaBezLenia += 1;
      if (seriaBezLenia >= 30) return true;
    }
  }
  return false;
}

export function obliczOdblokowaneAchievementy() {
  const { aktualna, najdluzsza } = obliczPasse();
  const najlepszaPassa = Math.max(aktualna, najdluzsza);
  const sumaKm = obliczSumeKm();
  const sesje = obliczSesje();
  const dzisiaj = toKey(new Date());

  return {
    streak_3: najlepszaPassa >= 3,
    streak_7: najlepszaPassa >= 7,
    streak_14: najlepszaPassa >= 14,
    streak_30: najlepszaPassa >= 30,
    streak_60: najlepszaPassa >= 60,
    streak_100: najlepszaPassa >= 100,
    km_50: sumaKm >= 50,
    km_100: sumaKm >= 100,
    km_250: sumaKm >= 250,
    sesje_bieganie_10: (sesje.bieganie || 0) >= 10,
    sesje_drazki_10: (sesje.drazki || 0) >= 10,
    dzien_startu: Boolean(mockProfil.data_startu_planu) && dzisiaj >= mockProfil.data_startu_planu,
    dzien_wyscigu: Boolean(mockProfil.data_polmaratonu) && dzisiaj >= mockProfil.data_polmaratonu,
    powrot_po_przerwie: sprawdzPowrotPoPrzerwie(),
    miesiac_bez_lenia: sprawdzMiesiacBezLenia(),
  };
}
