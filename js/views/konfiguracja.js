import {
  mockProfil,
  mockPlan,
  mockWpisyWagi,
  zapiszProfil,
  zapiszWpisyWagi,
  zapiszPlan,
  wyczyscWszystkieDane,
  eksportujDane,
  importujDane,
  toKey,
  addDays,
} from "../state.js";

// Telefony (zwłaszcza iPhone przy wpisywaniu/wklejaniu przez niektóre pola)
// potrafią podmienić proste cudzysłowy " i ' na "inteligentne" wersje typu
// " " „ ‟ ‘ ’ — dla oka wygląda tak samo, ale JSON.parse się na tym wywala.
// Zamieniamy je z powrotem na zwykłe ASCII przed parsowaniem.
function naprawCudzyslowy(tekst) {
  return tekst
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
}

// AI notorycznie dokleja "Oto Twój plan:" na początku i ```json dookoła.
// Zamiast prosić, żeby tego nie robiło — po prostu bierzemy wszystko
// od pierwszego { do ostatniego }.
function wytnijJson(tekst) {
  const start = tekst.indexOf("{");
  const koniec = tekst.lastIndexOf("}");
  if (start === -1 || koniec === -1 || koniec < start) return tekst;
  return tekst.slice(start, koniec + 1);
}

// Przecinek przed zamykającym nawiasem — drugi najczęstszy błąd modeli.
function usunWiszacePrzecinki(tekst) {
  return tekst.replace(/,(\s*[}\]])/g, "$1");
}

function przygotujDoParsowania(tekst) {
  return usunWiszacePrzecinki(wytnijJson(naprawCudzyslowy(tekst)));
}

function escapeHtml(tekst) {
  return tekst.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Okno importu: zawsze 28 dni, licząc od miejsca, w którym kończy się plan ---

const DNI_W_OKNIE = 28;

function oknoImportu() {
  const klucze = Object.keys(mockPlan).sort();
  const dzis = toKey(new Date());

  let od;
  if (klucze.length) {
    const poOstatnim = toKey(addDays(new Date(klucze[klucze.length - 1]), 1));
    od = poOstatnim < dzis ? dzis : poOstatnim; // plan się zestarzał → start od dziś
  } else {
    od = mockProfil.data_startu_planu || dzis;
  }

  const doDnia = toKey(addDays(new Date(od), DNI_W_OKNIE - 1));
  return { od, doDnia, ostatniWPlanie: klucze.length ? klucze[klucze.length - 1] : null };
}

function listaDatOkna(od) {
  return [...Array(DNI_W_OKNIE)].map((_, i) => toKey(addDays(new Date(od), i)));
}

// --- Treść instrukcji dla AI ---

function generujInstrukcje(kategorie, od, doDnia) {
  const listaKategorii = kategorie.join(", ");

  // Schemat pokazuje tylko te kategorie, które user faktycznie wybrał.
  const przykladoweDni = [];

  const dzienA = [];
  if (kategorie.includes("bieganie")) {
    dzienA.push(`    "bieganie": {
      "opis": "Interwały 2 min bieg / 3 min marsz, 6 powtórzeń",
      "tempo": "5:30-6:00 min/km",
      "strefa_tetna": "Strefa 2",
      "zakres_tetna": "128-142 bpm",
      "kalorie": 320
    }`);
  }
  if (kategorie.includes("drazki")) {
    dzienA.push(`    "drazki": {
      "cwiczenia": [
        { "nazwa": "Podciąganie nachwytem", "ilosc": "4x6" },
        { "nazwa": "Zwis aktywny", "ilosc": "3x30s" }
      ],
      "kalorie": 180
    }`);
  }
  const walkiLubSilownia = kategorie.find((k) => k === "sporty_walki" || k === "silownia");
  if (walkiLubSilownia) {
    dzienA.push(`    "${walkiLubSilownia}": true`);
  }
  przykladoweDni.push(`  "${od}": {\n${dzienA.join(",\n")}\n  }`);

  if (kategorie.includes("dom")) {
    przykladoweDni.push(`  "${toKey(addDays(new Date(od), 1))}": {
    "dom": {
      "cwiczenia": [
        { "nazwa": "Pompki", "ilosc": "4x15" },
        { "nazwa": "Przysiady", "ilosc": "4x20" }
      ],
      "kalorie": 210
    }
  }`);
  }
  przykladoweDni.push(`  "${toKey(addDays(new Date(od), 2))}": {}`);

  const schemat = `{\n  "dni": {\n${przykladoweDni.join(",\n")}\n  }\n}`;

  // Opis pól — tylko dla wybranych kategorii.
  const pola = [];
  if (kategorie.includes("bieganie")) {
    pola.push(`"bieganie" — obiekt z pięcioma polami, wszystkie obowiązkowe:
   "opis"          string, konkretna treść treningu
   "tempo"         string, ZAWSZE dokładnie w formacie "M:SS-M:SS min/km"
   "strefa_tetna"  string, ZAWSZE dokładnie "Strefa N", gdzie N to cyfra 1-5
   "zakres_tetna"  string, ZAWSZE dokładnie w formacie "NNN-NNN bpm"
   "kalorie"       LICZBA, bez cudzysłowów, bez słowa "kcal" (poprawnie: 320, błędnie: "320 kcal")`);
  }
  if (kategorie.includes("drazki")) {
    pola.push(`"drazki" — obiekt z dwoma polami:
   "cwiczenia"     tablica obiektów { "nazwa": string, "ilosc": string }
                   "ilosc" to ZAWSZE string, nawet gdy to sama liczba: "4x6", "3x30s", "10"
   "kalorie"       LICZBA`);
  }
  if (kategorie.includes("dom")) {
    pola.push(`"dom" — dokładnie taka sama struktura jak "drazki": "cwiczenia" + "kalorie".`);
  }
  if (walkiLubSilownia) {
    pola.push(`"${walkiLubSilownia}" — wartość to dokładnie true (wartość logiczna, NIE "true" w cudzysłowach).
   Bez opisu, bez ćwiczeń, bez kalorii. Sam fakt, że tego dnia trening jest.`);
  }

  return `Zamieniasz nasz gotowy plan treningowy na plik JSON dla mojej aplikacji.

To zadanie techniczne, nie planistyczne. NIE układasz planu od nowa, NIE zmieniasz jego treści, NIE dodajesz nic od siebie — przepisujesz to, co już wspólnie ustaliliśmy, do formatu poniżej. Jeśli czegoś w naszym planie brakuje (np. tętna dla danego biegu), uzupełnij to sensownie, ale nie przebudowuj planu.

ZAKRES: dokładnie dni od ${od} do ${doDnia}. To ${DNI_W_OKNIE} dni. Ani jednego mniej, ani jednego więcej. Nie wychodź poza ten zakres, nawet jeśli plan obejmuje dłuższy okres — resztę wygeneruję osobno.

KATEGORIE: ${listaKategorii}. Żadnych innych kluczy kategorii.

FORMA ODPOWIEDZI: wyłącznie JSON. Bez wstępu, bez komentarza na końcu, bez znaczników \`\`\`json. Twoja odpowiedź w całości trafia prosto do pliku .json — pierwszy znak to {, ostatni to }.

SCHEMAT — skopiuj tę strukturę dokładnie:

${schemat}

ZASADY:

1. Najwyższy poziom to obiekt z jednym kluczem: "dni". Nic więcej — bez "meta", bez "fazy", bez "plan".
2. Wewnątrz "dni" kluczem jest data w formacie "RRRR-MM-DD". Muszą wystąpić WSZYSTKIE ${DNI_W_OKNIE} dni z zakresu, po kolei, bez luk.
3. Dzień bez żadnego treningu to pusty obiekt: {}. Nie pomijaj takiego dnia i nie wpisuj w nim "odpoczynek".
4. W danym dniu umieszczaj TYLKO te kategorie, które faktycznie tego dnia występują. Pozostałe po prostu pomiń.
5. Nazwy kluczy kategorii zapisuj dokładnie tak, jak w schemacie — małymi literami, bez polskich znaków, bez spacji (${listaKategorii}).

POLA:

${pola.map((p, i) => `${i + 1}. ${p}`).join("\n\n")}

CZEGO NIE ROBIĆ:

- Nie dodawaj pól spoza schematu (żadnych "uwagi", "notatki", "dzien_tygodnia", "faza").
- Nie skracaj odpowiedzi. Żadnych "...", "// pozostałe dni analogicznie", "(tu powtórz schemat)". Każdy z ${DNI_W_OKNIE} dni wypisany w całości.
- Nie planuj km marszu ani niczego związanego z dietą — to jest poza zakresem tego pliku.
- Nie owijaj odpowiedzi w markdown.

ZANIM WYŚLESZ, SPRAWDŹ:

1. Pierwszy znak odpowiedzi to {, ostatni to }.
2. W "dni" jest dokładnie ${DNI_W_OKNIE} kluczy: od "${od}" do "${doDnia}", bez ani jednej brakującej daty.
3. Nigdzie nie ma przecinka bezpośrednio przed } ani przed ].
4. Każde "kalorie" to liczba, nie tekst.
5. Użyte są wyłącznie klucze kategorii z listy: ${listaKategorii}.`;
}

export function mount(container, wroc) {
  let krok = 1;

  async function eksportuj() {
    const dane = eksportujDane();
    const tekst = JSON.stringify(dane, null, 2);
    const nazwaPliku = `backup-do-startu-${new Date().toISOString().slice(0, 10)}.json`;
    const plik = new File([tekst], nazwaPliku, { type: "application/json" });

    if (navigator.canShare && navigator.canShare({ files: [plik] })) {
      try {
        await navigator.share({ files: [plik], title: "Backup danych treningowych" });
        return;
      } catch (err) {
        // user anulował albo udostępnianie się nie udało — spadamy do zwykłego pobrania
      }
    }

    const url = URL.createObjectURL(plik);
    const a = document.createElement("a");
    a.href = url;
    a.download = nazwaPliku;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function obslugaImportu(event) {
    const plik = event.target.files[0];
    if (!plik) return;

    try {
      const tekst = naprawCudzyslowy(await plik.text());
      const dane = JSON.parse(tekst);
      await importujDane(dane);
      renderKrok1();
      container.querySelector("#backup-komunikat").innerHTML =
        `<p class="komunikat-sukces">Backup wczytany. Sprawdź pozostałe zakładki.</p>`;
    } catch (err) {
      const komunikat = container.querySelector("#backup-komunikat");
      if (komunikat) komunikat.innerHTML = `<p class="komunikat-blad">Nie udało się wczytać pliku: ${err.message}</p>`;
    }
  }

  // Wspólna ścieżka dla importu planu z pliku i z wklejonego tekstu.
  function przetworzPlan(surowyTekst, oczekiwaneOd) {
    const dane = JSON.parse(przygotujDoParsowania(surowyTekst));
    if (!dane.dni || typeof dane.dni !== "object") {
      throw new Error("Brak sekcji 'dni'.");
    }

    const klucze = Object.keys(dane.dni);
    const zleFormaty = klucze.filter((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k));
    if (zleFormaty.length) {
      throw new Error(`Klucze dni nie są datami RRRR-MM-DD (np. "${zleFormaty[0]}").`);
    }

    Object.assign(mockPlan, dane.dni);
    zapiszPlan();

    // Ostrzeżenie, a nie błąd — plan i tak się zapisał.
    const oczekiwane = listaDatOkna(oczekiwaneOd);
    const brakujace = oczekiwane.filter((d) => !(d in dane.dni));
    return { ile: klucze.length, brakujace };
  }

  function pokazWynikImportu(wynik) {
    const komunikat = container.querySelector("#import-komunikat");
    let html = `<p class="komunikat-sukces">Zaimportowano ${wynik.ile} dni planu.</p>`;
    if (wynik.brakujace.length) {
      html += `<p class="komunikat-blad">Uwaga: brakuje ${wynik.brakujace.length} dni z oczekiwanego zakresu (pierwszy: ${wynik.brakujace[0]}). AI prawdopodobnie urwało odpowiedź — poproś o brakujące dni i zaimportuj je ponownie.</p>`;
    }
    komunikat.innerHTML = html;
  }

  function pokazBladImportu(err) {
    const komunikat = container.querySelector("#import-komunikat");
    if (komunikat) {
      komunikat.innerHTML = `<p class="komunikat-blad">Nie udało się wczytać: ${err.message}</p>`;
    }
  }

  function renderKrok1() {
    const kat = mockProfil.kategorie_wybrane;
    const czwartySlot = kat.includes("sporty_walki") ? "sporty_walki" : kat.includes("silownia") ? "silownia" : "brak";
    const ostatniaWaga = mockWpisyWagi.length ? mockWpisyWagi[mockWpisyWagi.length - 1].waga_kg : "";

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wroc">‹ Więcej</button>
      <div class="topbar"><span class="data">Konfiguracja</span></div>

      <div class="sekcja-naglowek">Kategorie treningowe</div>
      <div class="kat-checkboxy">
        <label class="kat-wiersz">
          <input type="checkbox" checked disabled />
          <span>Bieganie (zawsze aktywne)</span>
        </label>
        <label class="kat-wiersz">
          <input type="checkbox" data-kat="drazki" ${kat.includes("drazki") ? "checked" : ""} />
          <span>Drążki</span>
        </label>
        <label class="kat-wiersz">
          <input type="checkbox" data-kat="dom" ${kat.includes("dom") ? "checked" : ""} />
          <span>Dom</span>
        </label>
      </div>

      <div class="sekcja-naglowek">Sporty walki albo siłownia (jedno z dwóch)</div>
      <div class="kat-checkboxy">
        <label class="kat-wiersz">
          <input type="radio" name="czwarty-slot" value="brak" ${czwartySlot === "brak" ? "checked" : ""} />
          <span>Żadne</span>
        </label>
        <label class="kat-wiersz">
          <input type="radio" name="czwarty-slot" value="sporty_walki" ${czwartySlot === "sporty_walki" ? "checked" : ""} />
          <span>Sporty walki</span>
        </label>
        <label class="kat-wiersz">
          <input type="radio" name="czwarty-slot" value="silownia" ${czwartySlot === "silownia" ? "checked" : ""} />
          <span>Siłownia</span>
        </label>
      </div>

      <div class="sekcja-naglowek">Dane profilowe</div>
      <div class="fixed-row">
        <div class="fixed-item">
          <label>Wzrost (cm)</label>
          <input type="number" class="km-input" id="wzrost-input" value="${mockProfil.wzrost_cm}" />
        </div>
        <div class="fixed-divider"></div>
        <div class="fixed-item">
          <label>Wiek</label>
          <input type="number" class="km-input" id="wiek-input" value="${mockProfil.wiek}" />
        </div>
      </div>
      <div class="fixed-row" style="margin-top:0.5rem">
        <div class="fixed-item">
          <label>Waga (kg)</label>
          <input type="number" step="0.1" class="km-input" id="waga-input" value="${ostatniaWaga}" />
        </div>
      </div>

      <div class="sekcja-naglowek">Terminy</div>
      <div class="fixed-row">
        <div class="fixed-item">
          <label>Start planu</label>
          <input type="date" class="km-input data-input" id="start-input" value="${mockProfil.data_startu_planu}" />
        </div>
      </div>
      <div class="fixed-row" style="margin-top:0.5rem">
        <div class="fixed-item">
          <label>Półmaraton</label>
          <input type="date" class="km-input data-input" id="race-input" value="${mockProfil.data_polmaratonu}" />
        </div>
      </div>

      <button class="dodaj-btn" data-action="dalej">Przejdź do importu planu</button>

      <div class="sekcja-naglowek">Kopia zapasowa</div>
      <p class="opis-sekcji">Dane siedzą tylko na tym urządzeniu. Eksportuj je od czasu do czasu, żeby nie stracić historii przy zmianie telefonu albo wyczyszczeniu przeglądarki.</p>
      <button class="dodaj-btn" data-action="eksportuj">Eksportuj dane</button>
      <button class="dodaj-btn" data-action="importuj-wybierz">Importuj dane z pliku</button>
      <input type="file" accept="application/json" id="import-plik" style="display:none" />
      <div id="backup-komunikat"></div>

      <div class="sekcja-naglowek">Strefa niebezpieczna</div>
      <button class="reset-btn" data-action="wyczysc">Wyczyść wszystkie dane</button>
      <div id="reset-komunikat"></div>
    `;

    container.querySelector("[data-action='eksportuj']").onclick = eksportuj;
    container.querySelector("[data-action='importuj-wybierz']").onclick = () => {
      container.querySelector("#import-plik").click();
    };
    container.querySelector("#import-plik").onchange = obslugaImportu;

    container.querySelector("[data-action='wyczysc']").onclick = async () => {
      const na_pewno = confirm(
        "To usunie WSZYSTKO: checkboxy, km marszu, wagę, wzrost, rekordy, achievementy i zaimportowany plan. Nie da się cofnąć. Na pewno?"
      );
      if (!na_pewno) return;
      await wyczyscWszystkieDane();
      renderKrok1();
    };

    container.querySelector("[data-action='wroc']").onclick = wroc;
    container.querySelector("[data-action='dalej']").onclick = () => {
      const kategorie = ["bieganie"];
      container.querySelectorAll("[data-kat]").forEach((cb) => {
        if (cb.checked) kategorie.push(cb.dataset.kat);
      });
      const czwarty = container.querySelector("[name='czwarty-slot']:checked").value;
      if (czwarty !== "brak") kategorie.push(czwarty);

      mockProfil.kategorie_wybrane = kategorie;
      mockProfil.wzrost_cm = Number(container.querySelector("#wzrost-input").value);
      mockProfil.wiek = Number(container.querySelector("#wiek-input").value);
      mockProfil.data_startu_planu = container.querySelector("#start-input").value;
      mockProfil.data_polmaratonu = container.querySelector("#race-input").value;

      const waga = parseFloat(container.querySelector("#waga-input").value);
      if (waga) {
        const dzis = new Date().toISOString().slice(0, 10);
        const istniejacy = mockWpisyWagi.find((w) => w.data === dzis);
        if (istniejacy) istniejacy.waga_kg = waga;
        else mockWpisyWagi.push({ data: dzis, waga_kg: waga });
        zapiszWpisyWagi();
      }

      zapiszProfil();
      krok = 2;
      renderKrok2();
    };
  }

  function renderKrok2() {
    const { od, doDnia, ostatniWPlanie } = oknoImportu();
    const instrukcja = generujInstrukcje(mockProfil.kategorie_wybrane, od, doDnia);

    const statusPlanu = ostatniWPlanie
      ? `Plan masz wypełniony do <strong>${ostatniWPlanie}</strong>. Kolejny fragment: ${od} – ${doDnia}.`
      : `Plan jest pusty. Pierwszy fragment: ${od} – ${doDnia}.`;

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wstecz">‹ Ustawienia</button>
      <div class="topbar"><span class="data">Import planu</span></div>

      <p class="opis-sekcji">${statusPlanu}</p>
      <p class="opis-sekcji">Najpierw ustal plan treningowy w rozmowie z AI. Dopiero potem wklej poniższą instrukcję w tę samą rozmowę — zamieni ustalenia na plik dla apki. Plan wgrywa się fragmentami po ${DNI_W_OKNIE} dni, bo dłuższe AI zwykle urywa.</p>

      <div class="sekcja-naglowek">1. Wklej instrukcję do rozmowy z AI</div>
      <pre class="ai-instrukcja">${escapeHtml(instrukcja)}</pre>
      <button class="dodaj-btn" data-action="kopiuj">Kopiuj instrukcję</button>

      <div class="sekcja-naglowek">2. Wklej odpowiedź AI tutaj</div>
      <textarea class="import-textarea" id="wklej-plan" placeholder="Wklej całą odpowiedź AI"></textarea>
      <button class="dodaj-btn" data-action="importuj-wklejone">Zaimportuj wklejone</button>

      <div class="sekcja-naglowek">…albo wczytaj z pliku .json</div>
      <button class="dodaj-btn" data-action="importuj-plan-wybierz">Wybierz plik .json</button>
      <input type="file" accept="application/json,.json" id="import-plan-plik" style="display:none" />
      <div id="import-komunikat"></div>
    `;

    container.querySelector("[data-action='wstecz']").onclick = () => {
      krok = 1;
      renderKrok1();
    };

    container.querySelector("[data-action='kopiuj']").onclick = (e) => {
      navigator.clipboard.writeText(instrukcja).then(() => {
        e.target.textContent = "Skopiowano";
        setTimeout(() => (e.target.textContent = "Kopiuj instrukcję"), 1500);
      });
    };

    container.querySelector("[data-action='importuj-wklejone']").onclick = () => {
      const tekst = container.querySelector("#wklej-plan").value;
      if (!tekst.trim()) return;
      try {
        pokazWynikImportu(przetworzPlan(tekst, od));
      } catch (err) {
        pokazBladImportu(err);
      }
    };

    container.querySelector("[data-action='importuj-plan-wybierz']").onclick = () => {
      container.querySelector("#import-plan-plik").click();
    };
    container.querySelector("#import-plan-plik").onchange = async (event) => {
      const plik = event.target.files[0];
      if (!plik) return;
      try {
        pokazWynikImportu(przetworzPlan(await plik.text(), od));
      } catch (err) {
        pokazBladImportu(err);
      }
    };
  }

  renderKrok1();
}
