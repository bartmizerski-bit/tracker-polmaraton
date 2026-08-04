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
