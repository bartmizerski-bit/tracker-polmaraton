// ---------------------------------------------------------------------
// Dane i pomocnicze funkcje wspólne dla widoków.
// Realne dane trzymane w pamięci (obiekty poniżej) i lustrzanie
// zapisywane w IndexedDB (patrz inicjalizujStan / funkcje zapiszXxx).
// Zaczynają jako puste — użytkownik wypełnia je przez Konfigurację
// i codzienne korzystanie z apki.
// ---------------------------------------------------------------------

export const CATEGORY_LABELS = {
  bieganie: "Bieganie",
  drazki: "Drążki",
  dom: "Dom",
  sporty_walki: "Sporty walki",
};

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

// --- Profil usera (puste/neutralne wartości na start) ---
export const mockProfil = {
  wzrost_cm: "",
  wiek: "",
  kategorie_wybrane: ["bieganie"],
  data_startu_planu: toKey(new Date()),
  data_polmaratonu: toKey(addDays(new Date(), 90)),
  domyslny_timer_sek: 60,
};

// --- Wpisy wagi (puste na start, do BMI) ---
export const mockWpisyWagi = [];

export function obliczBMI(wagaKg, wzrostCm) {
  const wzrostM = wzrostCm / 100;
  return wagaKg / (wzrostM * wzrostM);
}

// --- Achievementy ---
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
  { id: "sesje_bieganie_10", nazwa: "Dziesięć razy w butach do biegania", opis: "10 sesji biegowych" },
  { id: "sesje_drazki_10", nazwa: "Dłonie już znają drążek", opis: "10 sesji na drążkach" },
  { id: "dzien_startu", nazwa: "Największy entuzjazm tego cyklu", opis: "Dzień 1 planu" },
  { id: "powrot_po_przerwie", nazwa: "Wróciłeś. Kolana też się zdziwiły", opis: "Powrót zaraz po dniu przerwy" },
  { id: "miesiac_bez_lenia", nazwa: "Ani jednego lenia", opis: "Miesiąc bez dnia oznaczonego jako leń" },
  { id: "dzien_wyscigu", nazwa: "Dzień wyścigu", opis: "Dzień półmaratonu" },
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
    const [profil, plan, wpisyWagi, pr, achWlasne, dni] = await Promise.all([
      dbGet("meta", "profil"),
      dbGet("meta", "plan"),
      dbGet("meta", "wpisyWagi"),
      dbGet("meta", "pr"),
      dbGet("meta", "achievementyWlasne"),
      dbGetAll("dni"),
    ]);

    if (profil) Object.assign(mockProfil, profil);
    if (plan) Object.assign(mockPlan, plan);
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

// --- Backup: eksport/import całej bazy do pliku JSON ---
export function eksportujDane() {
  return {
    wersja: 1,
    eksportowano: new Date().toISOString(),
    profil: mockProfil,
    plan: mockPlan,
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

  if (dane.profil) Object.assign(mockProfil, dane.profil);
  if (dane.plan) Object.assign(mockPlan, dane.plan);
  if (Array.isArray(dane.wpisyWagi)) mockWpisyWagi.splice(0, mockWpisyWagi.length, ...dane.wpisyWagi);
  if (dane.pr) Object.assign(mockPR, dane.pr);
  if (Array.isArray(dane.achievementyWlasne)) {
    mockAchievementyWlasne.splice(0, mockAchievementyWlasne.length, ...dane.achievementyWlasne);
  }
  if (dane.dni) Object.assign(mockRealizacja, dane.dni);

  await zapiszProfil();
  await zapiszPlan();
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
  mockWpisyWagi.splice(0, mockWpisyWagi.length);
  mockAchievementyWlasne.splice(0, mockAchievementyWlasne.length);
  mockPR.czas_1km.wpisy = [];
  mockPR.czas_5km.wpisy = [];
  mockPR.podciagniecia_neutralne.wpisy = [];
  mockPR.wlasne = [];

  mockProfil.wzrost_cm = "";
  mockProfil.wiek = "";
  mockProfil.kategorie_wybrane = ["bieganie"];
  mockProfil.data_startu_planu = toKey(new Date());
  mockProfil.data_polmaratonu = toKey(addDays(new Date(), 90));
  mockProfil.domyslny_timer_sek = 60;
}
