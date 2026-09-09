import {
  mockProfil,
  mockPlan,
  mockWpisyWagi,
  etykietyKategorii,
  zapiszProfil,
  zapiszWpisyWagi,
  zapiszPlan,
  zapiszEtykietyKategorii,
  wyczyscWszystkieDane,
  eksportujDane,
  importujDane,
  slugKategorii,
  znormalizujPresetyTimera,
  toKey,
  addDays,
} from "../state.js";

// Odczytuje trzy pola presetów timera; puste/bzdurne wartości wracają
// do domyślnych 30/60/90 zamiast psuć widget w widoku dnia.
function zbierzPresetyTimera(container) {
  const wartosci = [0, 1, 2].map((i) => container.querySelector(`#timer-input-${i}`)?.value);
  return znormalizujPresetyTimera(wartosci);
}

// Telefony (zwłaszcza iPhone przy wpisywaniu/wklejaniu przez niektóre pola)
// potrafią podmienić proste cudzysłowy " i ' na "inteligentne" wersje typu
// " " „ ‟ ‘ ’ — dla oka wygląda tak samo, ale JSON.parse się na tym wywala.
// Zamieniamy je z powrotem na zwykłe ASCII przed parsowaniem.
function naprawCudzyslowy(tekst) {
  return tekst
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
}

// Okno kolejnego fragmentu planu do wygenerowania: zawsze 14 dni (2 tygodnie,
// licząc razem z dzisiejszym dniem) licząc od dzisiaj, niezależnie od tego,
// co już siedzi w mockPlan — user chce zawsze świeży fragment "od teraz",
// nie kontynuację starego importu.
function obliczOknoPlanu() {
  const poczatek = toKey(new Date());
  const koniec = toKey(addDays(new Date(), 13));
  return { poczatek, koniec };
}

// Walidacja segmentów — dotyczy KAŻDEJ kategorii, która ich używa,
// nie tylko biegania. Wyłapuje najczęstsze błędy AI zanim niedokończony
// plan wyląduje w bazie i zepsuje widok dnia.
function sprawdzSegmenty(dni) {
  const problemy = [];

  Object.entries(dni).forEach(([data, dzien]) => {
    if (!dzien || typeof dzien !== "object") return;

    Object.entries(dzien).forEach(([kategoria, wpis]) => {
      if (!wpis || typeof wpis !== "object") return;
      if (!Array.isArray(wpis.segmenty)) return;

      if (wpis.segmenty.length === 0) {
        problemy.push(`${data} / ${kategoria}: pusta tablica "segmenty"`);
        return;
      }

      wpis.segmenty.forEach((segment, i) => {
        const gdzie = `${data} / ${kategoria}, segment ${i + 1}`;
        if (!segment || typeof segment !== "object") {
          problemy.push(`${gdzie}: segment nie jest obiektem`);
          return;
        }

        if (Array.isArray(segment.czesci)) {
          if (!segment.powtorzenia) problemy.push(`${gdzie}: blok bez "powtorzenia"`);
          if (!segment.czesci.length) problemy.push(`${gdzie}: pusta lista "czesci"`);
          segment.czesci.forEach((czesc, j) => {
            if (Array.isArray(czesc.czesci)) {
              problemy.push(`${gdzie}.${j + 1}: zagnieżdżony blok powtórzeń (niedozwolone)`);
            }
            if (!czesc.czas_min && !czesc.dystans_km) {
              problemy.push(`${gdzie}.${j + 1}: brak "czas_min" i "dystans_km"`);
            }
          });
          return;
        }

        if (!segment.czas_min && !segment.dystans_km) {
          problemy.push(`${gdzie}: brak "czas_min" i "dystans_km"`);
        }
      });
    });
  });

  return problemy;
}

// ---------------------------------------------------------------------
// Instrukcja dla AI. Nie mówi nic o konkretnych sportach — opisuje trzy
// możliwe FORMY ZAPISU treningu i pozwala AI wybrać właściwą dla każdej
// kategorii i każdego dnia z osobna.
// ---------------------------------------------------------------------
function generujInstrukcje(kategorie, okno) {
  const doPlanowania = kategorie.filter((k) => !k.ai_nie_planuje);
  const bezPlanowania = kategorie.filter((k) => k.ai_nie_planuje);

  const listaKategorii = kategorie
    .map(
      (k) =>
        `- id: "${k.id}", nazwa wyświetlana: "${k.nazwa}" — ${
          k.ai_nie_planuje
            ? "NIE układasz treści tego treningu, tylko zaznaczasz dni jego wystąpienia"
            : "układasz treść treningu"
        }`
    )
    .join("\n");

  const zdaniePytanie = bezPlanowania.length
    ? `Jedyne pytanie, jakie wolno Ci zadać przed wygenerowaniem planu, dotyczy dni tygodnia, w które user trenuje kategorie oznaczone jako "nie układasz treści" — i tylko wtedy, gdy naprawdę tego nie wiesz. Poza tym wypadkiem: żadnych pytań, żadnego dopytywania — generuj plan od razu.`
    : `Nie zadawaj żadnych pytań przed wygenerowaniem planu — generuj go od razu.`;

  let tekst = `Jesteś generatorem planu treningowego pod ogólną sprawność i przekraczanie własnych granic. To plan ciągły — bez sztywnego terminu, bez konkretnej daty docelowej ani konkretnego wydarzenia (np. zawodów), do którego trening ma prowadzić.
WYNIK MUSI BYĆ GOTOWYM PLIKIEM .json DO POBRANIA — nie tekstem wklejonym w treści wiadomości. Wygeneruj plik (np. uruchamiając kod) i podaj go jako plik do pobrania. To jest wymóg, nie opcja: jeśli Twoje środowisko pozwala na wygenerowanie pliku, masz obowiązek to zrobić, nawet jeśli wklejenie tekstu byłoby szybsze. Wklejenie samego JSON-a jako tekstu w odpowiedzi jest akceptowalne WYŁĄCZNIE wtedy, gdy tworzenie plików jest technicznie niemożliwe w tej rozmowie.
Niezależnie od formy: treść musi być WYŁĄCZNIE poprawnym JSON-em zgodnym ze schematem poniżej. Nic więcej — żadnego tekstu przed ani po, żadnego code fence markdown (bez \`\`\`json na początku i \`\`\` na końcu). Ta odpowiedź trafi bezpośrednio do aplikacji jako plik .json, więc jedno dodatkowe słowo, zdanie albo znacznik code fence sprawi, że plik będzie nieprawidłowy.
${zdaniePytanie}

KATEGORIE TRENINGOWE USERA — używaj DOKŁADNIE tych id jako kluczy w JSON-ie:
${listaKategorii}

Zasady:
1. Struktura pliku: { "meta": { "kategorie": { ... } }, "dni": { ... } }.
2. "meta.kategorie" to mapa id → nazwa wyświetlana, dla każdego id użytego w planie. Przykład: { "bieganie": "Bieganie", "silownia": "Siłownia" }. Aplikacja bierze stąd napisy na kafelkach.
3. Sekcję "dni" wypełnij WYŁĄCZNIE dla okresu od ${okno.poczatek} do ${okno.koniec} (14 dni, 2 tygodnie licząc razem z dzisiejszym dniem). Klucz dnia to data "RRRR-MM-DD". Nie generuj dni spoza tego okna — kolejny fragment wygeneruję osobno, tym samym promptem, gdy ten okres się skończy.
4. Dla każdego dnia dodaj wpis TYLKO dla kategorii, które faktycznie tego dnia występują — pomiń pozostałe. Dzień bez treningu = pusty obiekt {} albo brak klucza dnia.
5. Kolejność kluczy w obrębie dnia decyduje o kolejności kafelków w aplikacji — układaj je tak, jak trening ma przebiegać.

FORMY ZAPISU TRENINGU
Każdą kategorię możesz w danym dniu zapisać na jeden z trzech sposobów. Wybór należy do Ciebie i może się różnić dzień po dniu — ta sama kategoria może być raz rozpisana na segmenty, a raz jako lista ćwiczeń.

A) SEGMENTY — trening rozpisany krok po kroku w tablicy "segmenty".
   Stosuj wszędzie tam, gdzie trening ma strukturę w czasie: bieg z rozgrzewką i schłodzeniem, interwały, obwód, rundy sparingowe, serie na siłowni, rozgrzewka + część główna + rozciąganie. To NIE jest forma zarezerwowana dla biegania — użyj jej dla dowolnej kategorii, jeśli tak jest czytelniej.
   User ma wiedzieć dokładnie, co robić minuta po minucie — nie wolno chować struktury treningu w opisie.

   Segment prosty:
   { "nazwa": "Trucht", "czas_min": 10, "dystans_km": 2, "tempo": "6:30-7:00 min/km", "strefa_tetna": "Strefa 2", "zakres_tetna": "125-140 bpm", "obciazenie": "60 kg" }
   - "nazwa" wymagana; wymagane też co najmniej jedno z "czas_min" / "dystans_km" (liczby, nie tekst).
   - "tempo", "strefa_tetna", "zakres_tetna", "obciazenie", "dystans_km" są OPCJONALNE — podawaj tylko te, które mają sens dla danej aktywności. Dla treningu siłowego zwykle "obciazenie" zamiast tempa, dla rundy sparingowej często sam czas.
   - jeśli podajesz tempo lub tętno, podawaj je OSOBNO DLA KAŻDEGO SEGMENTU — rozgrzewka, część główna i schłodzenie mają różne wartości. Nigdy nie podawaj jednej uśrednionej wartości dla całego treningu.
   - opcjonalne "opis": jedno krótkie zdanie wskazówki do tego segmentu.

   Segment powtarzany (interwały, rundy, serie):
   { "powtorzenia": 6, "czesci": [ segment prosty, segment prosty ] }
   - bez "nazwa", bez "czas_min" na tym poziomie — czas liczy się z części.
   - NIE zagnieżdżaj bloku powtarzanego wewnątrz innego bloku. Maksymalnie jedno piętro.

   Dalsze zasady:
   - Wysiłek ciągły = jeden segment prosty. Nie rozbijaj go sztucznie.
   - Rozgrzewkę i schłodzenie zawsze jako osobne segmenty, nigdy jako wzmiankę w opisie.
   - "opis" treningu to jedno zdanie o CELU (np. "Interwały tempowe pod próg mleczanowy."), bez powtarzania struktury.
   - "dystans_km" na poziomie treningu (opcjonalnie) = łączny dystans. ŁĄCZNEGO CZASU NIE PODAWAJ — aplikacja liczy go sama z segmentów.
   Formaty sztywne, jeśli podajesz: tempo ZAWSZE "M:SS-M:SS min/km", zakres_tetna ZAWSZE "NNN-NNN bpm".

   Przykład dnia z segmentami:
   "bieganie": {
     "opis": "Interwały tempowe.",
     "dystans_km": 8,
     "segmenty": [
       { "nazwa": "Rozgrzewka", "czas_min": 10, "tempo": "6:30-7:00 min/km", "strefa_tetna": "Strefa 2", "zakres_tetna": "125-140 bpm" },
       { "powtorzenia": 6, "czesci": [
         { "nazwa": "Bieg szybki", "czas_min": 2, "tempo": "4:40-5:00 min/km", "strefa_tetna": "Strefa 4", "zakres_tetna": "160-172 bpm" },
         { "nazwa": "Trucht", "czas_min": 3, "tempo": "7:00-7:30 min/km", "strefa_tetna": "Strefa 2", "zakres_tetna": "130-145 bpm" }
       ]},
       { "nazwa": "Schłodzenie", "czas_min": 10, "tempo": "6:30-7:00 min/km", "strefa_tetna": "Strefa 1", "zakres_tetna": "115-130 bpm" }
     ]
   }

B) LISTA ĆWICZEŃ — tablica "cwiczenia" z obiektami { "nazwa", "ilosc" }.
   Stosuj tam, gdzie liczy się zestaw ćwiczeń, a nie oś czasu.
   "ilosc" ma być krótkie i konkretne — sama liczba/zakres i jednostka (np. "8-10 powt.", "3x8", "30 sek."). BEZ dopisków w nawiasach, BEZ komentarzy typu "ile dasz radę", "w każdą stronę", uwag o obecnym poziomie usera itp. Jeśli chcesz dodać kontekst, to wyłącznie w krótkim, osobnym polu "opis" — nie upychaj go w "ilosc".

   Przykład:
   "drazki": { "cwiczenia": [ { "nazwa": "Podciąganie nachwytem", "ilosc": "3x6" }, { "nazwa": "Wisy", "ilosc": "30 sek." } ] }

C) SAMO POTWIERDZENIE — wartość true, bez opisu.
   Stosuj dla kategorii, których nie układasz — user wie, co robi, aplikacja ma tylko dać checkbox.

   Przykład: "silownia": true

Możesz łączyć A i B w jednym wpisie (segmenty + lista ćwiczeń), jeśli trening ma część czasową i część "do odhaczenia".`;

  let numer = 6;

  if (doPlanowania.length) {
    tekst += `

${numer}. Kategorie, które układasz (${doPlanowania.map((k) => `"${k.id}"`).join(", ")}): wybierz dla nich formę A lub B — tę, która lepiej opisuje dany trening. Nie używaj dla nich formy C.`;
    numer++;
  }

  if (bezPlanowania.length) {
    tekst += `

${numer}. Kategorie o stałym grafiku (${bezPlanowania.map((k) => `"${k.id}"`).join(", ")}): NIE planuj ich treści — to user ustala, co tam robi. Wstaw je wyłącznie w formie C (wartość true) w dniach, w które user faktycznie trenuje. Jeśli NIE wiesz, w które dni tygodnia one wypadają — zapytaj o to PRZED wygenerowaniem planu, zamiast zgadywać.`;
    numer++;
  }

  tekst += `

${numer}. NIE planuj km marszu ani niczego związanego z dietą — poza zakresem tego pliku.`;
  numer++;

  tekst += `

${numer}. Zanim oddasz plik, sprawdź po kolei:
   - czy to poprawny JSON, bez code fence i bez tekstu wokół,
   - czy są dokładnie klucze "meta" i "dni" na najwyższym poziomie,
   - czy "meta.kategorie" zawiera nazwę dla każdego użytego id,
   - czy każdy klucz kategorii w dniach jest jednym z id z listy powyżej,
   - czy każdy segment ma "nazwa" i co najmniej jedno z "czas_min"/"dystans_km",
   - czy żaden blok "powtorzenia" nie jest zagnieżdżony w innym,
   - czy zakres dat mieści się w ${okno.poczatek} – ${okno.koniec}.`;

  return tekst;
}

export function mount(container, wroc) {
  // Robocza kopia listy kategorii — edytowana w miejscu, zapisywana na bieżąco.
  let kategorie = mockProfil.kategorie_wybrane.map((k) => ({ ...k }));

  function zapiszKategorie() {
    mockProfil.kategorie_wybrane = kategorie
      .filter((k) => k.id && k.nazwa.trim())
      .map((k) => ({ id: k.id, nazwa: k.nazwa.trim(), ai_nie_planuje: Boolean(k.ai_nie_planuje) }));
    mockProfil.kategorie_wybrane.forEach((k) => {
      etykietyKategorii[k.id] = k.nazwa;
    });
    zapiszProfil();
    zapiszEtykietyKategorii();
  }

  function nadajId(pozycja, nazwa) {
    if (pozycja.id) return; // id nadajemy raz — zmiana nazwy nie może zerwać powiązania z planem
    let baza = slugKategorii(nazwa);
    if (!baza) return;
    let kandydat = baza;
    let n = 2;
    while (kategorie.some((k) => k !== pozycja && k.id === kandydat)) {
      kandydat = `${baza}_${n}`;
      n += 1;
    }
    pozycja.id = kandydat;
  }

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
      kategorie = mockProfil.kategorie_wybrane.map((k) => ({ ...k }));
      renderKrok1();
      container.querySelector("#backup-komunikat").innerHTML =
        `<p class="komunikat-sukces">Backup wczytany. Sprawdź pozostałe zakładki.</p>`;
    } catch (err) {
      const komunikat = container.querySelector("#backup-komunikat");
      if (komunikat) komunikat.innerHTML = `<p class="komunikat-blad">Nie udało się wczytać pliku: ${err.message}</p>`;
    }
  }

  async function obslugaImportuPlanu(event) {
    const plik = event.target.files[0];
    if (!plik) return;
    const komunikat = container.querySelector("#import-komunikat");

    try {
      const surowyTekst = naprawCudzyslowy(await plik.text());
      const dane = JSON.parse(surowyTekst);
      if (!dane.dni || typeof dane.dni !== "object") {
        throw new Error("Brak sekcji 'dni' w pliku.");
      }

      const problemy = sprawdzSegmenty(dane.dni);

      // Nazwy kategorii z planu gromadzimy kumulatywnie — stare wpisy zostają,
      // żeby historia sprzed miesięcy nadal miała czytelne etykiety.
      const nazwy = dane.meta && dane.meta.kategorie;
      let noweNazwy = 0;
      if (nazwy && typeof nazwy === "object") {
        Object.entries(nazwy).forEach(([id, nazwa]) => {
          if (typeof nazwa === "string" && nazwa.trim()) {
            if (!etykietyKategorii[id]) noweNazwy += 1;
            etykietyKategorii[id] = nazwa.trim();
          }
        });
        zapiszEtykietyKategorii();
      }

      Object.assign(mockPlan, dane.dni);
      delete mockPlan.meta;
      zapiszPlan();

      const daty = Object.keys(dane.dni).sort();
      let html = `<p class="komunikat-sukces">Zaimportowano ${daty.length} dni planu (${daty[0]} – ${daty[daty.length - 1]}). Sprawdź zakładkę Dziś/Tydzień.</p>`;
      if (noweNazwy) {
        html += `<p class="opis-sekcji">Nowe kategorie z planu: ${noweNazwy}.</p>`;
      }
      if (problemy.length) {
        const lista = problemy.slice(0, 8).map((p) => `<li>${p}</li>`).join("");
        const reszta = problemy.length > 8 ? `<li>…i ${problemy.length - 8} więcej</li>` : "";
        html += `
          <p class="komunikat-blad">Plan zapisany, ale AI nie trzymało się schematu w ${problemy.length} miejscach — te treningi wyświetlą się niekompletnie:</p>
          <ul class="lista-problemow">${lista}${reszta}</ul>
          <p class="opis-sekcji">Najprościej: wklej AI listę problemów i poproś o poprawiony plik.</p>
        `;
      }
      komunikat.innerHTML = html;
    } catch (err) {
      komunikat.innerHTML = `<p class="komunikat-blad">To nie jest poprawny plik JSON zgodny ze schematem: ${err.message}</p>`;
    }
  }

  function htmlKategorii() {
    if (!kategorie.length) {
      return `<p class="pusta-lista">Brak kategorii. Dodaj tyle, ile chcesz — nazwy są dowolne.</p>`;
    }
    return kategorie
      .map(
        (k, i) => `
      <div class="kat-edycja" data-idx="${i}">
        <div class="kat-edycja-glowa">
          <input type="text" class="kat-nazwa-input" data-pole="nazwa" data-idx="${i}"
                 value="${k.nazwa.replace(/"/g, "&quot;")}" placeholder="Nazwa kategorii" />
          <button class="kat-usun" data-action="usun-kat" data-idx="${i}" aria-label="Usuń kategorię">×</button>
        </div>
        <label class="kat-flaga">
          <input type="checkbox" data-pole="flaga" data-idx="${i}" ${k.ai_nie_planuje ? "checked" : ""} />
          <span>AI tego nie układa — tylko wstawia dni</span>
        </label>
        <span class="kat-id">${k.id ? `id: ${k.id}` : "id nada się po wpisaniu nazwy"}</span>
      </div>
    `
      )
      .join("");
  }

  function odswiezListeKategorii() {
    const lista = container.querySelector("#kat-lista");
    if (lista) lista.innerHTML = htmlKategorii();
  }

  function renderKrok1() {
    const ostatniaWaga = mockWpisyWagi.length ? mockWpisyWagi[mockWpisyWagi.length - 1].waga_kg : "";
    const presetyTimera = znormalizujPresetyTimera(mockProfil.timer_presety_sek);

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wroc">‹ Więcej</button>
      <div class="topbar"><span class="data">Konfiguracja</span></div>

      <div class="sekcja-naglowek">Kategorie treningowe</div>
      <p class="opis-sekcji">Nazwy są dowolne — aplikacja wyświetli każdą kategorię, jaka pojawi się w planie. Ta lista służy tylko do zbudowania instrukcji dla AI.</p>
      <div class="kat-lista" id="kat-lista">${htmlKategorii()}</div>
      <button class="dodaj-btn" data-action="dodaj-kat">Dodaj kategorię</button>

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

      <div class="sekcja-naglowek">Timer przerwy</div>
      <div class="fixed-row">
        <div class="fixed-item">
          <label>Preset 1 (sek.)</label>
          <input type="number" step="1" min="1" class="km-input" id="timer-input-0" value="${presetyTimera[0]}" />
        </div>
        <div class="fixed-divider"></div>
        <div class="fixed-item">
          <label>Preset 2 (sek.)</label>
          <input type="number" step="1" min="1" class="km-input" id="timer-input-1" value="${presetyTimera[1]}" />
        </div>
        <div class="fixed-divider"></div>
        <div class="fixed-item">
          <label>Preset 3 (sek.)</label>
          <input type="number" step="1" min="1" class="km-input" id="timer-input-2" value="${presetyTimera[2]}" />
        </div>
      </div>
      <p class="opis-sekcji">Trzy przyciski nad kafelkami w każdym dniu — odliczanie startuje jednym kliknięciem, bez wchodzenia tutaj.</p>

      <button class="dodaj-btn" data-action="dalej">Generuj instrukcję dla AI</button>
      <div id="krok1-komunikat"></div>

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

    const lista = container.querySelector("#kat-lista");

    // Wpisywanie nazwy: aktualizujemy tablicę bez przerenderowania,
    // żeby nie stracić kursora w polu tekstowym.
    lista.oninput = (e) => {
      const el = e.target;
      if (el.dataset.pole !== "nazwa") return;
      const idx = Number(el.dataset.idx);
      if (!kategorie[idx]) return;
      kategorie[idx].nazwa = el.value;
    };

    // Zatwierdzenie pola (blur / zmiana checkboxa) — nadajemy id i zapisujemy.
    lista.onchange = (e) => {
      const el = e.target;
      const idx = Number(el.dataset.idx);
      if (!kategorie[idx]) return;

      if (el.dataset.pole === "nazwa") {
        kategorie[idx].nazwa = el.value;
        const bylId = kategorie[idx].id;
        nadajId(kategorie[idx], el.value);
        zapiszKategorie();
        if (!bylId && kategorie[idx].id) odswiezListeKategorii();
        return;
      }

      if (el.dataset.pole === "flaga") {
        kategorie[idx].ai_nie_planuje = el.checked;
        zapiszKategorie();
      }
    };

    lista.onclick = (e) => {
      const el = e.target.closest("[data-action='usun-kat']");
      if (!el) return;
      const idx = Number(el.dataset.idx);
      kategorie.splice(idx, 1);
      zapiszKategorie();
      odswiezListeKategorii();
    };

    container.querySelector("[data-action='dodaj-kat']").onclick = () => {
      kategorie.push({ id: "", nazwa: "", ai_nie_planuje: false });
      odswiezListeKategorii();
      const pola = container.querySelectorAll("[data-pole='nazwa']");
      const ostatnie = pola[pola.length - 1];
      if (ostatnie) ostatnie.focus();
    };

    container.querySelector("[data-action='eksportuj']").onclick = eksportuj;

    container.querySelectorAll("[id^='timer-input-']").forEach((input) => {
      input.onchange = () => {
        mockProfil.timer_presety_sek = zbierzPresetyTimera(container);
        zapiszProfil();
      };
    });

    container.querySelector("[data-action='importuj-wybierz']").onclick = () => {
      container.querySelector("#import-plik").click();
    };
    container.querySelector("#import-plik").onchange = obslugaImportu;

    container.querySelector("[data-action='wyczysc']").onclick = async () => {
      const na_pewno = confirm(
        "To usunie WSZYSTKO: checkboxy, km marszu, wagę, wzrost, rekordy, achievementy, kategorie i zaimportowany plan. Nie da się cofnąć. Na pewno?"
      );
      if (!na_pewno) return;
      await wyczyscWszystkieDane();
      kategorie = [];
      renderKrok1();
    };

    container.querySelector("[data-action='wroc']").onclick = wroc;

    container.querySelector("[data-action='dalej']").onclick = () => {
      // Nadaj id kategoriom, którym user wpisał nazwę i od razu kliknął dalej.
      kategorie.forEach((k) => nadajId(k, k.nazwa));
      zapiszKategorie();

      if (!mockProfil.kategorie_wybrane.length) {
        container.querySelector("#krok1-komunikat").innerHTML =
          `<p class="komunikat-blad">Dodaj przynajmniej jedną kategorię z nazwą — inaczej nie ma czego planować.</p>`;
        return;
      }

      mockProfil.wzrost_cm = Number(container.querySelector("#wzrost-input").value);
      mockProfil.wiek = Number(container.querySelector("#wiek-input").value);

      mockProfil.timer_presety_sek = zbierzPresetyTimera(container);

      const waga = parseFloat(container.querySelector("#waga-input").value);
      if (waga) {
        const dzis = new Date().toISOString().slice(0, 10);
        const istniejacy = mockWpisyWagi.find((w) => w.data === dzis);
        if (istniejacy) istniejacy.waga_kg = waga;
        else mockWpisyWagi.push({ data: dzis, waga_kg: waga });
        zapiszWpisyWagi();
      }

      zapiszProfil();
      renderKrok2();
    };
  }

  function renderKrok2() {
    const okno = obliczOknoPlanu();
    const instrukcja = generujInstrukcje(mockProfil.kategorie_wybrane, okno);

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wstecz">‹ Ustawienia</button>
      <div class="topbar"><span class="data">Import planu</span></div>
      <p class="opis-sekcji">Ten fragment obejmuje: ${okno.poczatek} – ${okno.koniec} (2 tygodnie, licząc razem z dzisiejszym dniem). Kolejny fragment wygenerujesz tu ponownie, gdy ten się skończy.</p>

      <div class="sekcja-naglowek">1. Skopiuj instrukcję do Claude lub ChatGPT</div>
      <pre class="ai-instrukcja">${instrukcja.replace(/</g, "&lt;")}</pre>
      <button class="dodaj-btn" data-action="kopiuj">Kopiuj instrukcję</button>

      <div class="sekcja-naglowek">2. Zapisz odpowiedź AI jako plik .json i zaimportuj</div>
      <button class="dodaj-btn" data-action="importuj-plan-wybierz">Wybierz plik .json</button>
      <input type="file" accept="application/json,.json" id="import-plan-plik" style="display:none" />
      <div id="import-komunikat"></div>
    `;

    container.querySelector("[data-action='wstecz']").onclick = () => {
      renderKrok1();
    };

    container.querySelector("[data-action='kopiuj']").onclick = (e) => {
      navigator.clipboard.writeText(instrukcja).then(() => {
        e.target.textContent = "Skopiowano";
        setTimeout(() => (e.target.textContent = "Kopiuj instrukcję"), 1500);
      });
    };

    container.querySelector("[data-action='importuj-plan-wybierz']").onclick = () => {
      container.querySelector("#import-plan-plik").click();
    };
    container.querySelector("#import-plan-plik").onchange = obslugaImportuPlanu;
  }

  renderKrok1();
}
