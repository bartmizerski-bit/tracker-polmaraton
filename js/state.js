// ---------------------------------------------------------------------
// Dane i pomocnicze funkcje wspólne dla widoków.
// UWAGA: mockPlan i mockRealizacja to dane na sztywno (demo).
// W docelowej wersji plan pochodzi z importu AI, a realizacja z IndexedDB.
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

function kluczDniTemu(n) {
  return toKey(addDays(new Date(), -n));
}
function kluczZaNDni(n) {
  return toKey(addDays(new Date(), n));
}

// --- Przykładowy plan (mock) — tak wygląda scalony import z AI ---
export const mockPlan = {
  [kluczDniTemu(3)]: {
    bieganie: {
      opis: "Bieg ciągły, spokojne tempo",
      tempo: "6:00-6:30 min/km",
      strefa_tetna: "Strefa 2",
      zakres_tetna: "120-135 bpm",
    },
    dom: {
      cwiczenia: [
        { nazwa: "Pompki", ilosc: "4x15" },
        { nazwa: "Przysiady", ilosc: "4x20" },
      ],
    },
  },
  [kluczDniTemu(2)]: {
    drazki: {
      cwiczenia: [
        { nazwa: "Podciąganie podchwytem", ilosc: "4x5" },
        { nazwa: "Zwis aktywny", ilosc: "3x30s" },
      ],
    },
    sporty_walki: true,
  },
  [kluczDniTemu(1)]: {
    bieganie: {
      opis: "Interwały 1 min szybko / 2 min truchtem, 8 powtórzeń",
      tempo: "4:50-5:10 min/km",
      strefa_tetna: "Strefa 4",
      zakres_tetna: "155-168 bpm",
    },
  },
  [toKey(new Date())]: {
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
  },
  [kluczZaNDni(1)]: {
    dom: {
      cwiczenia: [
        { nazwa: "Plank", ilosc: "3x45s" },
        { nazwa: "Wykroki", ilosc: "3x12" },
      ],
    },
  },
  [kluczZaNDni(2)]: {
    bieganie: {
      opis: "Bieg długi, spokojne tempo",
      tempo: "6:15-6:45 min/km",
      strefa_tetna: "Strefa 2",
      zakres_tetna: "122-136 bpm",
    },
    drazki: {
      cwiczenia: [{ nazwa: "Podciąganie nachwytem", ilosc: "3x5" }],
    },
  },
  [kluczZaNDni(3)]: {
    sporty_walki: true,
  },
};

// --- Realizacja (mock) — kilka dni na sztywno, pokazujące różne stany ---
export const mockRealizacja = {
  [kluczDniTemu(3)]: {
    stan_dnia: "normalny",
    km_marsz: { wartosc: 5.2, potwierdzone: true },
    trzymanie_michy: true,
    kategorie: { bieganie: "zrealizowany", dom: "zrealizowany" },
  },
  [kluczDniTemu(2)]: {
    stan_dnia: "przerwa",
    km_marsz: { wartosc: 2.0, potwierdzone: true },
    trzymanie_michy: false,
  },
  [kluczDniTemu(1)]: {
    stan_dnia: "normalny",
    km_marsz: { wartosc: 6.1, potwierdzone: true },
    trzymanie_michy: true,
    kategorie: { bieganie: "czesciowo" },
  },
};

export function getPlanDay(dateKey) {
  return mockPlan[dateKey] || {};
}

export function getRealizacja(dateKey) {
  if (!mockRealizacja[dateKey]) {
    mockRealizacja[dateKey] = {
      stan_dnia: "normalny",
      km_marsz: { wartosc: "", potwierdzone: false },
      trzymanie_michy: false,
      kategorie: {},
    };
  }
  return mockRealizacja[dateKey];
}

// --- Profil usera (mock) ---
export const mockProfil = {
  wzrost_cm: 178,
  wiek: 29,
  kategorie_wybrane: ["bieganie", "drazki", "dom", "sporty_walki"],
  data_startu_planu: toKey(new Date()),
  data_polmaratonu: toKey(addDays(new Date(), 90)),
};

// --- Wpisy wagi (mock, do BMI) ---
export const mockWpisyWagi = [
  { data: kluczDniTemu(30), waga_kg: 84.1 },
  { data: kluczDniTemu(23), waga_kg: 83.4 },
  { data: kluczDniTemu(16), waga_kg: 82.9 },
  { data: kluczDniTemu(9), waga_kg: 82.3 },
  { data: kluczDniTemu(2), waga_kg: 81.9 },
];

export function obliczBMI(wagaKg, wzrostCm) {
  const wzrostM = wzrostCm / 100;
  return wagaKg / (wzrostM * wzrostM);
}

// --- Achievementy (mock) ---
export const mockAchievementyAutomatyczne = [
  { id: "streak_3", nazwa: "Rozgrzewka się skończyła", opis: "3 dni z rzędu", odblokowany: true },
  { id: "streak_7", nazwa: "Tydzień bez wymówek", opis: "7 dni z rzędu", odblokowany: true },
  { id: "streak_14", nazwa: "Dwa tygodnie, zero dram", opis: "14 dni z rzędu", odblokowany: false },
  { id: "streak_30", nazwa: "Miesiąc bez wymówek", opis: "30 dni z rzędu", odblokowany: false },
  { id: "streak_60", nazwa: "Kolana już przywykły", opis: "60 dni z rzędu", odblokowany: false },
  { id: "streak_100", nazwa: "To już nawyk, nie wyczyn", opis: "100 dni z rzędu", odblokowany: false },
  { id: "km_50", nazwa: "Buty już to czują", opis: "50 km marszu sumarycznie", odblokowany: true },
  { id: "km_100", nazwa: "Można by dojść do sąsiedniego miasta", opis: "100 km marszu sumarycznie", odblokowany: false },
  { id: "km_250", nazwa: "Chodząca ambicja", opis: "250 km marszu sumarycznie", odblokowany: false },
  { id: "sesje_bieganie_10", nazwa: "Dziesięć razy w butach do biegania", opis: "10 sesji biegowych", odblokowany: true },
  { id: "sesje_drazki_10", nazwa: "Dłonie już znają drążek", opis: "10 sesji na drążkach", odblokowany: false },
  { id: "dzien_startu", nazwa: "Największy entuzjazm tego cyklu", opis: "Dzień 1 planu", odblokowany: true },
  { id: "powrot_po_przerwie", nazwa: "Wróciłeś. Kolana też się zdziwiły", opis: "Powrót zaraz po dniu przerwy", odblokowany: true },
  { id: "miesiac_bez_lenia", nazwa: "Ani jednego lenia", opis: "Miesiąc bez dnia oznaczonego jako leń", odblokowany: false },
  { id: "dzien_wyscigu", nazwa: "Dzień wyścigu", opis: "Dzień półmaratonu", odblokowany: false },
];

export const mockAchievementyWlasne = [
  { id: "custom_1", nazwa: "Pierwszy bieg bez zatrzymania", opis: "", data: kluczDniTemu(12) },
];

// --- Rekordy personalne (mock) ---
export const PR_LABELS = {
  czas_1km: "Czas na 1 km",
  czas_5km: "Czas na 5 km",
  podciagniecia_neutralne: "Podciągnięcia (chwyt neutralny)",
};

export const mockPR = {
  czas_1km: { kierunek: "malejaco", wpisy: [
    { data: kluczDniTemu(20), wartosc: "4:48" },
    { data: kluczDniTemu(10), wartosc: "4:40" },
    { data: kluczDniTemu(2), wartosc: "4:32" },
  ]},
  czas_5km: { kierunek: "malejaco", wpisy: [
    { data: kluczDniTemu(15), wartosc: "26:10" },
    { data: kluczDniTemu(3), wartosc: "25:20" },
  ]},
  podciagniecia_neutralne: { kierunek: "rosnaco", wpisy: [
    { data: kluczDniTemu(18), wartosc: "6" },
    { data: kluczDniTemu(5), wartosc: "8" },
  ]},
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
