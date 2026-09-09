// ---------------------------------------------------------------------
// Prawdziwe liczenie statystyk i odblokowań achievementów na podstawie
// zapisanej realizacji (mockRealizacja / IndexedDB) i planu.
//
// Nic tutaj nie zna nazw kategorii — wszystko liczy się po tym, co
// faktycznie siedzi w planie i realizacji danego dnia.
//
// UPROSZCZENIE: odblokowanie automatycznych achievementów liczy się
// na żywo przy każdym wejściu w widok, a nie jest zapisywane z datą
// odblokowania. Wynik widoczny dla użytkownika jest ten sam.
// ---------------------------------------------------------------------
import { mockRealizacja, mockPlan, toKey, addDays } from "./state.js";


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

// Bez sztywnej "daty startu planu" w profilu punktem odniesienia dla passy
// i statystyk jest najwcześniejsza data, dla której faktycznie coś zapisano
// (realizacja albo plan). Brak danych → zakres zwija się do samego dzisiaj.
function najwczesniejszaDataDanych() {
  const klucze = [...Object.keys(mockRealizacja), ...Object.keys(mockPlan)];
  if (!klucze.length) return null;
  return klucze.reduce((min, klucz) => (klucz < min ? klucz : min), klucze[0]);
}

function zakresDat() {
  const dzisiaj = new Date();
  const najwczesniejszyKlucz = najwczesniejszaDataDanych();
  const start = najwczesniejszyKlucz ? new Date(najwczesniejszyKlucz) : dzisiaj;
  return { start: start <= dzisiaj ? start : dzisiaj, dzisiaj };
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

  const wartosciSesji = Object.values(sesje);
  const najmocniejszaKategoria = wartosciSesji.length ? Math.max(...wartosciSesji) : 0;
  const sesjeLacznie = wartosciSesji.reduce((a, b) => a + b, 0);

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
    sesje_kat_10: najmocniejszaKategoria >= 10,
    sesje_kat_50: najmocniejszaKategoria >= 50,
    sesje_lacznie_100: sesjeLacznie >= 100,
    powrot_po_przerwie: sprawdzPowrotPoPrzerwie(),
    miesiac_bez_lenia: sprawdzMiesiacBezLenia(),
  };
}
