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

function generujInstrukcje(kategorie, dataStartu, dataPolmaratonu) {
  let tekst = `Jesteś generatorem planu treningowego do przygotowań do półmaratonu.
Zwróć WYŁĄCZNIE poprawny JSON zgodny ze schematem poniżej — bez tekstu przed/po, bez code fence markdown.

Dane wejściowe: data startu planu: ${dataStartu}, data półmaratonu: ${dataPolmaratonu}, wybrane kategorie treningowe: ${kategorie.join(", ")}.

Zasady:
1. Struktura: { "meta": {...}, "dni": {...} }.
2. Podziel plan na min. 2 fazy (np. Baza / Budowanie / Szczyt / Tapering) w meta.fazy. Fazy MUSZĄ pokrywać cały zakres dat bez dziur i bez nakładania się.
3. Dla każdego dnia dodaj wpis TYLKO dla kategorii, które faktycznie tego dnia występują — pomiń pozostałe.`;

  let numer = 4;
  if (kategorie.includes("bieganie")) {
    tekst += `

${numer}. Dla "bieganie": opis treningu, tempo, strefa tętna, zakres tętna w bpm, szacowane kalorie.
   Format tempo: ZAWSZE "M:SS-M:SS min/km". Format zakres_tetna: ZAWSZE "NNN-NNN bpm".`;
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
    const nazwaPliku = `backup-po-co-mi-to-bylo-${new Date().toISOString().slice(0, 10)}.json`;
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
      const tekst = await plik.text();
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

      <div class="sekcja-naglowek">2. Wklej wygenerowany JSON</div>
      <textarea class="import-textarea" id="import-textarea" placeholder="Wklej tu odpowiedź od AI (sam JSON)"></textarea>
      <button class="dodaj-btn" data-action="importuj">Zaimportuj plan</button>
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

    container.querySelector("[data-action='importuj']").onclick = () => {
      const komunikat = container.querySelector("#import-komunikat");
      const surowyTekst = container.querySelector("#import-textarea").value.trim();
      try {
        const dane = JSON.parse(surowyTekst);
        if (!dane.dni || typeof dane.dni !== "object") {
          throw new Error("Brak sekcji 'dni' w pliku.");
        }
        Object.assign(mockPlan, dane.dni);
        zapiszPlan();
        komunikat.innerHTML = `<p class="komunikat-sukces">Zaimportowano ${Object.keys(dane.dni).length} dni planu. Sprawdź zakładkę Dziś/Tydzień.</p>`;
      } catch (err) {
        komunikat.innerHTML = `<p class="komunikat-blad">To nie jest poprawny JSON zgodny ze schematem: ${err.message}</p>`;
      }
    };
  }

  renderKrok1();
}
