// ---------------------------------------------------------------------
// Dane i pomocnicze funkcje wspólne dla widoków.
// Realne dane trzymane w pamięci (obiekty poniżej) i lustrzanie
// zapisywane w IndexedDB (patrz inicjalizujStan / funkcje zapiszXxx).
// Zaczynają jako puste — użytkownik wypełnia je przez Konfigurację
// i codzienne korzystanie z apki.
//
// KATEGORIE: aplikacja nie zna z góry żadnej listy sportów. Kategoria to
// zwykły klucz tekstowy pochodzący z zaimportowanego planu. Sposób
// wyświetlania wynika z KSZTAŁTU danych dnia (segmenty / ćwiczenia / nic),
// a nie z nazwy kategorii — dzięki temu ta sama kategoria może być raz
// rozpisana na segmenty, a raz jako lista ćwiczeń.
// ---------------------------------------------------------------------

export const TRISTATE_ORDER = ["niezrealizowany", "czesciowo", "zrealizowany"];

export function cycleTristate(current) {
  const i = TRISTATE_ORDER.indexOf(current);
  return TRISTATE_ORDER[(i + 1) % TRISTATE_ORDER.length];
}

export function toKey(date) {
  const d = new Date(date);
  const rok = d.getFullYear();
  const mies = String(d.getMonth() + 1).padStart(2, "0");
  const dzien = String(d.getDate()).padStart(2, "0");
  return `${rok}-${mies}-${dzien}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// --- Plan (pusty na start — wypełnia się przez import w Konfiguracji) ---
// Klucze to daty "RRRR-MM-DD". Metadane planu NIE trafiają tutaj.
export const mockPlan = {};

// --- Realizacja (pusta na start) ---
export const mockRealizacja = {};

export function getPlanDay(dateKey) {
  return mockPlan[dateKey] || {};
}

export function getRealizacja(dateKey) {
  if (!mockRealizacja[dateKey]) {
    mockRealizacja[dateKey] = {
      stan_dnia: "normalny",
      km_marsz: { wartosc: "" },
      trzymanie_michy: false,
      kategorie: {},
    };
  }
  return mockRealizacja[dateKey];
}

// ---------------------------------------------------------------------
// Etykiety kategorii
//
// Trzy poziomy, w tej kolejności:
//   1. etykietyKategorii — mapa id → nazwa przysłana w meta.kategorie planu,
//      gromadzona kumulatywnie między importami (stare wpisy nie znikają),
//   2. lista kategorii z Konfiguracji (mockProfil.kategorie_wybrane),
//   3. fallback wyliczony z samego id ("sporty_walki" → "Sporty walki").
// ---------------------------------------------------------------------
export const etykietyKategorii = {};

export function domyslnaEtykieta(id) {
  const tekst = String(id).replace(/_/g, " ").trim();
  if (!tekst) return String(id);
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

export function etykietaKategorii(id) {
  if (etykietyKategorii[id]) return etykietyKategorii[id];
  const zProfilu = (mockProfil.kategorie_wybrane || []).find((k) => k.id === id);
  if (zProfilu && zProfilu.nazwa) return zProfilu.nazwa;
  return domyslnaEtykieta(id);
}

// Id kategorii generowane z nazwy wpisanej przez usera w Konfiguracji.
const POLSKIE_ZNAKI = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

export function slugKategorii(nazwa) {
  return String(nazwa)
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (z) => POLSKIE_ZNAKI[z])
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// --- Profil usera (puste/neutralne wartości na start) ---
// kategorie_wybrane: [{ id, nazwa, ai_nie_planuje }]
// ai_nie_planuje = kategoria o stałym grafiku (siłownia, treningi klubowe itp.),
// której AI nie układa — tylko wstawia dni jej wystąpienia.
export const mockProfil = {
  wzrost_cm: "",
  wiek: "",
  kategorie_wybrane: [],
  // Trzy długości przerwy dostępne jednym kliknięciem w widoku dnia.
  timer_presety_sek: [30, 60, 90],
};

export const TIMER_PRESETY_DOMYSLNE = [30, 60, 90];

// Sanityzacja presetów timera — zawsze trzy dodatnie liczby całkowite.
export function znormalizujPresetyTimera(lista) {
  const zrodlo = Array.isArray(lista) ? lista : [];
  return TIMER_PRESETY_DOMYSLNE.map((domyslna, i) => {
    const n = Math.round(Number(zrodlo[i]));
    return Number.isFinite(n) && n > 0 ? n : domyslna;
  });
}

// Kategorie, które w starym modelu miały stały grafik i nie były planowane
// przez AI — przy migracji dostają flagę ai_nie_planuje.
const STARE_KATEGORIE_BEZ_PLANOWANIA = new Set(["sporty_walki", "silownia"]);

export function znormalizujKategorie(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((k) => {
      if (typeof k === "string") {
        return {
          id: k,
          nazwa: domyslnaEtykieta(k),
          ai_nie_planuje: STARE_KATEGORIE_BEZ_PLANOWANIA.has(k),
        };
      }
      if (k && typeof k === "object" && k.id) {
        return {
          id: String(k.id),
          nazwa: k.nazwa ? String(k.nazwa) : domyslnaEtykieta(k.id),
          ai_nie_planuje: Boolean(k.ai_nie_planuje),
        };
      }
      return null;
    })
    .filter(Boolean);
}

// --- Wpisy wagi (puste na start, do BMI) ---
export const mockWpisyWagi = [];

export function obliczBMI(wagaKg, wzrostCm) {
  const wzrostM = wzrostCm / 100;
  return wagaKg / (wzrostM * wzrostM);
}

// --- Achievementy ---
// Żaden nie jest przypięty do konkretnego sportu — apka nie zna nazw kategorii.
export const mockAchievementyAutomatyczne = [
  { id: "streak_3", nazwa: "Rozgrzewka się skończyła", opis: "3 dni z rzędu" },
  { id: "streak_7", nazwa: "Tydzień bez wymówek", opis: "7 dni z rzędu" },
  { id: "streak_14", nazwa: "Dwa tygodnie, zero dram", opis: "14 dni z rzędu" },
  { id: "streak_30", nazwa: "Miesiąc bez wymówek", opis: "30 dni z rzędu" },
  { id: "streak_60", nazwa: "Kolana już przywykły", opis: "60 dni z rzędu" },
  { id: "streak_100", nazwa: "To już nawyk, nie wyczyn", opis: "100 dni z rzędu" },
  { id: "km_50", nazwa: "Buty już to czują", opis: "50 km marszu sumarycznie" },
  { id: "km_100", nazwa: "Można by dojść do sąsiedniego miasta", opis: "100 km marszu sumarycznie" },
  { id: "km_250", nazwa: "Chodząca ambicja", opis: "250 km marszu sumarycznie" },
  { id: "sesje_kat_10", nazwa: "Dziesięć razy to samo", opis: "10 sesji w jednej kategorii" },
  { id: "sesje_kat_50", nazwa: "Pięćdziesiątka w jednej dyscyplinie", opis: "50 sesji w jednej kategorii" },
  { id: "sesje_lacznie_100", nazwa: "Setka na liczniku", opis: "100 odhaczonych sesji łącznie" },
  { id: "powrot_po_przerwie", nazwa: "Wróciłeś. Kolana też się zdziwiły", opis: "Powrót zaraz po dniu przerwy" },
  { id: "miesiac_bez_lenia", nazwa: "Ani jednego lenia", opis: "Miesiąc bez dnia oznaczonego jako leń" },
];

export const mockAchievementyWlasne = [];

// --- Rekordy personalne (stały zestaw kategorii, puste wpisy na start) ---
export const PR_LABELS = {
  czas_1km: "Czas na 1 km",
  czas_5km: "Czas na 5 km",
  podciagniecia_neutralne: "Podciągnięcia (chwyt neutralny)",
};

export const mockPR = {
  czas_1km: { kierunek: "malejaco", wpisy: [] },
  czas_5km: { kierunek: "malejaco", wpisy: [] },
  podciagniecia_neutralne: { kierunek: "rosnaco", wpisy: [] },
  wlasne: [],
};

export function parsujCzasDoSekund(str) {
  const [m, s] = str.split(":").map(Number);
  return m * 60 + s;
}

export function formatujSekundyDoCzasu(sek) {
  const m = Math.floor(sek / 60);
  const s = Math.round(sek % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// --- Wczytywanie i zapisywanie do IndexedDB ---
import { dbGet, dbSet, dbGetAll, dbClearAll } from "./db.js";

export async function inicjalizujStan() {
  try {
    const [profil, plan, etykiety, wpisyWagi, pr, achWlasne, dni] = await Promise.all([
      dbGet("meta", "profil"),
      dbGet("meta", "plan"),
      dbGet("meta", "etykietyKategorii"),
      dbGet("meta", "wpisyWagi"),
      dbGet("meta", "pr"),
      dbGet("meta", "achievementyWlasne"),
      dbGetAll("dni"),
    ]);

    if (profil) {
      Object.assign(mockProfil, profil);
      // Migracja starego formatu: tablica stringów → tablica obiektów.
      mockProfil.kategorie_wybrane = znormalizujKategorie(mockProfil.kategorie_wybrane);
      // Pozostałość po modelu faz — już nieużywane.
      delete mockProfil.ostatnia_ocena_postepu;
      delete mockProfil.data_polmaratonu;
      delete mockProfil.data_startu_planu;
      // Migracja: jedna domyślna długość timera → trzy presety.
      mockProfil.timer_presety_sek = znormalizujPresetyTimera(mockProfil.timer_presety_sek);
      delete mockProfil.domyslny_timer_sek;
    }
    if (plan) {
      Object.assign(mockPlan, plan);
      // Starsze zapisy mogły trzymać metadane razem z dniami — sprzątamy,
      // żeby "meta" nie udawało dnia w widoku tygodnia i statystykach.
      delete mockPlan.meta;
    }
    if (etykiety) Object.assign(etykietyKategorii, etykiety);
    if (wpisyWagi) mockWpisyWagi.splice(0, mockWpisyWagi.length, ...wpisyWagi);
    if (pr) Object.assign(mockPR, pr);
    if (achWlasne) mockAchievementyWlasne.splice(0, mockAchievementyWlasne.length, ...achWlasne);
    if (dni && Object.keys(dni).length) Object.assign(mockRealizacja, dni);
  } catch (err) {
    console.warn("Nie udało się wczytać zapisanych danych, używam wartości domyślnych.", err);
  }
}

export async function zapiszRealizacje(dateKey) {
  try {
    await dbSet("dni", dateKey, mockRealizacja[dateKey]);
  } catch (err) {
    console.warn("Nie udało się zapisać dnia:", err);
  }
}

export async function zapiszProfil() {
  try {
    await dbSet("meta", "profil", mockProfil);
  } catch (err) {
    console.warn("Nie udało się zapisać profilu:", err);
  }
}

export async function zapiszWpisyWagi() {
  try {
    await dbSet("meta", "wpisyWagi", mockWpisyWagi);
  } catch (err) {
    console.warn("Nie udało się zapisać wpisów wagi:", err);
  }
}

export async function zapiszPR() {
  try {
    await dbSet("meta", "pr", mockPR);
  } catch (err) {
    console.warn("Nie udało się zapisać rekordów:", err);
  }
}

export async function zapiszAchievementyWlasne() {
  try {
    await dbSet("meta", "achievementyWlasne", mockAchievementyWlasne);
  } catch (err) {
    console.warn("Nie udało się zapisać achievementów:", err);
  }
}

export async function zapiszPlan() {
  try {
    await dbSet("meta", "plan", mockPlan);
  } catch (err) {
    console.warn("Nie udało się zapisać planu:", err);
  }
}

export async function zapiszEtykietyKategorii() {
  try {
    await dbSet("meta", "etykietyKategorii", etykietyKategorii);
  } catch (err) {
    console.warn("Nie udało się zapisać nazw kategorii:", err);
  }
}

// --- Backup: eksport/import całej bazy do pliku JSON ---
export function eksportujDane() {
  return {
    wersja: 2,
    eksportowano: new Date().toISOString(),
    profil: mockProfil,
    plan: mockPlan,
    etykietyKategorii,
    wpisyWagi: mockWpisyWagi,
    pr: mockPR,
    achievementyWlasne: mockAchievementyWlasne,
    dni: mockRealizacja,
  };
}

export async function importujDane(dane) {
  if (!dane || typeof dane !== "object") {
    throw new Error("To nie jest poprawny plik backupu.");
  }

  if (dane.profil) {
    Object.assign(mockProfil, dane.profil);
    mockProfil.kategorie_wybrane = znormalizujKategorie(mockProfil.kategorie_wybrane);
    delete mockProfil.ostatnia_ocena_postepu;
    delete mockProfil.data_polmaratonu;
    delete mockProfil.data_startu_planu;
    mockProfil.timer_presety_sek = znormalizujPresetyTimera(mockProfil.timer_presety_sek);
    delete mockProfil.domyslny_timer_sek;
  }
  if (dane.plan) {
    Object.assign(mockPlan, dane.plan);
    delete mockPlan.meta;
  }
  if (dane.etykietyKategorii) Object.assign(etykietyKategorii, dane.etykietyKategorii);
  if (Array.isArray(dane.wpisyWagi)) mockWpisyWagi.splice(0, mockWpisyWagi.length, ...dane.wpisyWagi);
  if (dane.pr) Object.assign(mockPR, dane.pr);
  if (Array.isArray(dane.achievementyWlasne)) {
    mockAchievementyWlasne.splice(0, mockAchievementyWlasne.length, ...dane.achievementyWlasne);
  }
  if (dane.dni) Object.assign(mockRealizacja, dane.dni);

  await zapiszProfil();
  await zapiszPlan();
  await zapiszEtykietyKategorii();
  await zapiszWpisyWagi();
  await zapiszPR();
  await zapiszAchievementyWlasne();
  await Promise.all(Object.keys(mockRealizacja).map((klucz) => zapiszRealizacje(klucz)));
}

// --- Pełny reset (kasuje IndexedDB i czyści dane w pamięci) ---
export async function wyczyscWszystkieDane() {
  try {
    await dbClearAll();
  } catch (err) {
    console.warn("Nie udało się wyczyścić IndexedDB:", err);
  }

  for (const klucz of Object.keys(mockPlan)) delete mockPlan[klucz];
  for (const klucz of Object.keys(mockRealizacja)) delete mockRealizacja[klucz];
  for (const klucz of Object.keys(etykietyKategorii)) delete etykietyKategorii[klucz];
  mockWpisyWagi.splice(0, mockWpisyWagi.length);
  mockAchievementyWlasne.splice(0, mockAchievementyWlasne.length);
  mockPR.czas_1km.wpisy = [];
  mockPR.czas_5km.wpisy = [];
  mockPR.podciagniecia_neutralne.wpisy = [];
  mockPR.wlasne = [];

  mockProfil.wzrost_cm = "";
  mockProfil.wiek = "";
  mockProfil.kategorie_wybrane = [];
  mockProfil.timer_presety_sek = [...TIMER_PRESETY_DOMYSLNE];
}
