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

// Walidacja segmentów biegu — wyłapuje najczęstsze błędy AI zanim
// niedokończony plan wyląduje w bazie i zepsuje widok dnia.
function sprawdzPlanBiegowy(dni) {
  const problemy = [];

  Object.entries(dni).forEach(([data, dzien]) => {
    const bieg = dzien && dzien.bieganie;
    if (!bieg) return;

    if (!Array.isArray(bieg.segmenty) || bieg.segmenty.length === 0) {
      problemy.push(`${data}: brak tablicy "segmenty" w treningu biegowym`);
      return;
    }

    bieg.segmenty.forEach((segment, i) => {
      const gdzie = `${data}, segment ${i + 1}`;

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

  return problemy;
}

function generujInstrukcje(kategorie, dataStartu, dataPolmaratonu) {
  let tekst = `Jesteś generatorem planu treningowego do przygotowań do półmaratonu.
Zwróć WYŁĄCZNIE poprawny JSON zgodny ze schematem poniżej. Nic więcej — żadnego tekstu przed ani po, żadnego code fence markdown (bez \`\`\`json na początku i \`\`\` na końcu). Twoja odpowiedź zostanie zapisana bezpośrednio jako plik .json, więc jedno dodatkowe słowo, zdanie albo znacznik code fence sprawi, że plik będzie nieprawidłowy.

Dane wejściowe: data startu planu: ${dataStartu}, data półmaratonu: ${dataPolmaratonu}, wybrane kategorie treningowe: ${kategorie.join(", ")}.

Zasady:
1. Struktura: { "meta": {...}, "dni": {...} }.
2. Podziel plan na min. 2 fazy (np. Baza / Budowanie / Szczyt / Tapering) w meta.fazy. Fazy MUSZĄ pokrywać cały zakres dat bez dziur i bez nakładania się.
3. Dla każdego dnia dodaj wpis TYLKO dla kategorii, które faktycznie tego dnia występują — pomiń pozostałe.`;

  let numer = 4;
  if (kategorie.includes("bieganie")) {
    tekst += `

${numer}. Dla "bieganie" KAŻDY trening musi być rozpisany krok po kroku w tablicy "segmenty" (min. 1 element).
   Użytkownik ma wiedzieć dokładnie, co robić minuta po minucie — nie wolno chować struktury treningu w opisie.

   Segment prosty:
   { "nazwa": "Trucht", "czas_min": 10, "dystans_km": 2, "tempo": "6:30-7:00 min/km", "strefa_tetna": "Strefa 2", "zakres_tetna": "125-140 bpm" }
   - "nazwa" wymagana; wymagane też co najmniej jedno z "czas_min" / "dystans_km" (liczby, nie tekst).
   - tempo, strefa_tetna i zakres_tetna podawaj OSOBNO DLA KAŻDEGO SEGMENTU — trucht, bieg szybki i schłodzenie mają różne tempo i różne tętno. Nigdy nie podawaj jednego uśrednionego tempa dla całego treningu.
   - opcjonalne "opis": jedno krótkie zdanie wskazówki do tego segmentu.

   Segment powtarzany (interwały):
   { "powtorzenia": 6, "czesci": [ segment prosty, segment prosty ] }
   - bez "nazwa", bez "czas_min" na tym poziomie — czas liczy się z części.
   - NIE zagnieżdżaj bloku powtarzanego wewnątrz innego bloku. Maksymalnie jedno piętro.

   Dalsze zasady:
   - Bieg ciągły = jeden segment prosty. Nie rozbijaj go sztucznie.
   - Rozgrzewkę i schłodzenie zawsze jako osobne segmenty, nigdy jako wzmiankę w opisie.
   - "opis" treningu to jedno zdanie o CELU (np. "Interwały tempowe pod próg mleczanowy."), bez powtarzania struktury.
   - "dystans_km" na poziomie treningu (opcjonalnie) = łączny dystans. ŁĄCZNEGO CZASU NIE PODAWAJ — aplikacja liczy go sama z segmentów.
   - "kalorie": szacunek dla całego treningu.
   Formaty sztywne: tempo ZAWSZE "M:SS-M:SS min/km", zakres_tetna ZAWSZE "NNN-NNN bpm".

   Przykład kompletnego dnia biegowego:
   "bieganie": {
     "opis": "Interwały tempowe.",
     "dystans_km": 8,
     "kalorie": 380,
     "segmenty": [
       { "nazwa": "Rozgrzewka", "czas_min": 10, "tempo": "6:30-7:00 min/km", "strefa_tetna": "Strefa 2", "zakres_tetna": "125-140 bpm" },
       { "powtorzenia": 6, "czesci": [
         { "nazwa": "Bieg szybki", "czas_min": 2, "tempo": "4:40-5:00 min/km", "strefa_tetna": "Strefa 4", "zakres_tetna": "160-172 bpm" },
         { "nazwa": "Trucht", "czas_min": 3, "tempo": "7:00-7:30 min/km", "strefa_tetna": "Strefa 2", "zakres_tetna": "130-145 bpm" }
       ]},
       { "nazwa": "Schłodzenie", "czas_min": 10, "tempo": "6:30-7:00 min/km", "strefa_tetna": "Strefa 1", "zakres_tetna": "115-130 bpm" }
     ]
   }`;
    numer++;
  }
  if (kategorie.includes("drazki")) {
    tekst += `

${numer}. Dla "drazki": lista ćwiczeń jako tablica { "nazwa", "ilosc" } + szacowane kalorie.`;
    numer++;
  }
  if (kategorie.includes("dom")) {
    tekst += `

${numer}. Dla "dom": analogicznie jak drążki.`;
    numer++;
  }
  const walkiLubSilownia = kategorie.find((k) => k === "sporty_walki" || k === "silownia");
  if (walkiLubSilownia) {
    tekst += `

${numer}. Dla "${walkiLubSilownia}": wyłącznie wartość true w dniach wystąpienia — BEZ opisu, BEZ kalorii.`;
    numer++;
  }
  tekst += `

${numer}. NIE planuj km marszu ani niczego związanego z dietą — poza zakresem tego pliku.`;

  return tekst;
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

      const problemy = sprawdzPlanBiegowy(dane.dni);

      Object.assign(mockPlan, dane.dni);
      zapiszPlan();

      let html = `<p class="komunikat-sukces">Zaimportowano ${Object.keys(dane.dni).length} dni planu. Sprawdź zakładkę Dziś/Tydzień.</p>`;
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

      <button class="dodaj-btn" data-action="dalej">Generuj instrukcję dla AI</button>

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
    const instrukcja = generujInstrukcje(
      mockProfil.kategorie_wybrane,
      mockProfil.data_startu_planu,
      mockProfil.data_polmaratonu
    );

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wstecz">‹ Ustawienia</button>
      <div class="topbar"><span class="data">Import planu</span></div>

      <div class="sekcja-naglowek">1. Skopiuj instrukcję do Claude lub ChatGPT</div>
      <pre class="ai-instrukcja">${instrukcja}</pre>
      <button class="dodaj-btn" data-action="kopiuj">Kopiuj instrukcję</button>

      <div class="sekcja-naglowek">2. Zapisz odpowiedź AI jako plik .json i zaimportuj</div>
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

    container.querySelector("[data-action='importuj-plan-wybierz']").onclick = () => {
      container.querySelector("#import-plan-plik").click();
    };
    container.querySelector("#import-plan-plik").onchange = obslugaImportuPlanu;
  }

  renderKrok1();
}
