import { mockPR, PR_LABELS, parsujCzasDoSekund, zapiszPR } from "../state.js";

function wartoscNumeryczna(kierunek, wartosc) {
  return kierunek === "malejaco" ? parsujCzasDoSekund(String(wartosc)) : Number(wartosc);
}

function najlepszyWpis(kategoria) {
  const { kierunek, wpisy } = kategoria;
  if (!wpisy.length) return null;
  return wpisy.reduce((best, w) => {
    const wB = wartoscNumeryczna(kierunek, best.wartosc);
    const wW = wartoscNumeryczna(kierunek, w.wartosc);
    if (kierunek === "malejaco") return wW < wB ? w : best;
    return wW > wB ? w : best;
  });
}

function miniWykres(kategoria) {
  const { kierunek, wpisy } = kategoria;
  if (wpisy.length < 2) return `<p class="brak-wykresu">Za mało wpisów na wykres progresu.</p>`;

  const posortowane = [...wpisy].sort((a, b) => (a.data > b.data ? 1 : -1));
  const wartosciY = posortowane.map((w) => {
    const n = wartoscNumeryczna(kierunek, w.wartosc);
    return kierunek === "malejaco" ? -n : n; // im wyżej na wykresie, tym lepszy wynik
  });

  const min = Math.min(...wartosciY);
  const max = Math.max(...wartosciY);
  const zakres = max - min || 1;
  const szer = 280;
  const wys = 56;
  const margines = 6;

  const punkty = wartosciY
    .map((y, i) => {
      const x = margines + (i / (wartosciY.length - 1)) * (szer - margines * 2);
      const yPx = margines + (1 - (y - min) / zakres) * (wys - margines * 2);
      return `${x},${yPx}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${szer} ${wys}" class="pr-wykres" preserveAspectRatio="none">
      <polyline points="${punkty}" fill="none" stroke-width="2" />
    </svg>
  `;
}

function formatujWartosc(wartosc, jednostka) {
  return jednostka ? `${wartosc} ${jednostka}` : wartosc;
}

export function mount(container, wroc) {
  function znajdzKategorie(id) {
    return mockPR[id] || mockPR.wlasne.find((k) => k.id === id);
  }

  function kartaHtml(id, kategoria, nazwa) {
    const najlepszy = najlepszyWpis(kategoria);
    return `
      <div class="pr-card">
        <div class="pr-card-header">
          <span class="pr-nazwa">${nazwa}</span>
          <span class="pr-najlepszy">${
            najlepszy ? formatujWartosc(najlepszy.wartosc, kategoria.jednostka) : "Brak wpisów"
          }</span>
        </div>
        ${najlepszy ? miniWykres(kategoria) : `<p class="brak-wykresu">Dodaj pierwszy wynik.</p>`}
        <button class="dodaj-btn maly" data-action="dodaj-wpis" data-kategoria="${id}">+ Dodaj wynik</button>
        <div class="pr-formularz" data-formularz="${id}"></div>
      </div>
    `;
  }

  function render() {
    const stale = Object.entries(mockPR)
      .filter(([id]) => id !== "wlasne")
      .map(([id, kategoria]) => kartaHtml(id, kategoria, PR_LABELS[id] || id))
      .join("");

    const wlasne = mockPR.wlasne.map((kategoria) => kartaHtml(kategoria.id, kategoria, kategoria.nazwa)).join("");

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wroc">‹ Więcej</button>
      <div class="topbar"><span class="data">Rekordy personalne</span></div>
      ${stale}
      ${wlasne}
      <button class="dodaj-btn" data-action="pokaz-formularz-kategorii">+ Dodaj własną kategorię</button>
      <div id="kategoria-formularz"></div>
    `;

    container.querySelector("[data-action='wroc']").onclick = wroc;
    container.querySelectorAll("[data-action='dodaj-wpis']").forEach((btn) => {
      btn.onclick = () => pokazFormularzWpisu(btn.dataset.kategoria);
    });
    container.querySelector("[data-action='pokaz-formularz-kategorii']").onclick = pokazFormularzKategorii;
  }

  function pokazFormularzWpisu(id) {
    const kategoria = znajdzKategorie(id);
    const miejsce = container.querySelector(`[data-formularz="${id}"]`);
    const placeholder = kategoria.kierunek === "malejaco" ? "np. 4:28 (M:SS)" : "np. 9";
    miejsce.innerHTML = `
      <div class="mini-formularz">
        <input type="text" class="pr-wartosc-input" placeholder="${placeholder}" />
        <button data-action="zapisz-wpis">Zapisz</button>
      </div>
    `;
    miejsce.querySelector("[data-action='zapisz-wpis']").onclick = () => {
      const input = miejsce.querySelector(".pr-wartosc-input");
      const wartosc = input.value.trim();
      if (!wartosc) return;
      kategoria.wpisy.push({ data: new Date().toISOString().slice(0, 10), wartosc });
      zapiszPR();
      render();
    };
  }

  function pokazFormularzKategorii() {
    const miejsce = container.querySelector("#kategoria-formularz");
    miejsce.innerHTML = `
      <div class="mini-formularz">
        <input type="text" id="kat-nazwa" placeholder="Nazwa (np. Wyciskanie leżąc)" />
        <input type="text" id="kat-jednostka" placeholder="Jednostka (np. kg) — opcjonalnie" />
        <select id="kat-kierunek">
          <option value="rosnaco">Wyższy wynik = lepiej</option>
          <option value="malejaco">Niższy wynik = lepiej</option>
        </select>
        <button data-action="zapisz-kategorie">Dodaj</button>
      </div>
    `;
    miejsce.querySelector("[data-action='zapisz-kategorie']").onclick = () => {
      const nazwa = miejsce.querySelector("#kat-nazwa").value.trim();
      if (!nazwa) return;
      const jednostka = miejsce.querySelector("#kat-jednostka").value.trim();
      const kierunek = miejsce.querySelector("#kat-kierunek").value;
      mockPR.wlasne.push({ id: `custom_${Date.now()}`, nazwa, jednostka, kierunek, wpisy: [] });
      zapiszPR();
      render();
    };
  }

  render();
}
