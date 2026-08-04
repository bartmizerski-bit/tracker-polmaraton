import { mockPR, PR_LABELS, parsujCzasDoSekund, formatujSekundyDoCzasu } from "../state.js";

function wartoscNumeryczna(kierunek, wartosc) {
  return kierunek === "malejaco" ? parsujCzasDoSekund(String(wartosc)) : Number(wartosc);
}

function najlepszyWpis(kategoria) {
  const { kierunek, wpisy } = kategoria;
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

function formatujWartosc(kierunek, wartosc) {
  return kierunek === "malejaco" ? wartosc : wartosc;
}

export function mount(container, wroc) {
  function render() {
    const karty = Object.entries(mockPR)
      .map(([id, kategoria]) => {
        const najlepszy = najlepszyWpis(kategoria);
        return `
          <div class="pr-card">
            <div class="pr-card-header">
              <span class="pr-nazwa">${PR_LABELS[id] || id}</span>
              <span class="pr-najlepszy">${formatujWartosc(kategoria.kierunek, najlepszy.wartosc)}</span>
            </div>
            ${miniWykres(kategoria)}
            <button class="dodaj-btn maly" data-action="dodaj-wpis" data-kategoria="${id}">+ Dodaj wynik</button>
            <div class="pr-formularz" data-formularz="${id}"></div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wroc">‹ Więcej</button>
      <div class="topbar"><span class="data">Rekordy personalne</span></div>
      ${karty}
    `;

    container.querySelector("[data-action='wroc']").onclick = wroc;
    container.querySelectorAll("[data-action='dodaj-wpis']").forEach((btn) => {
      btn.onclick = () => pokazFormularzWpisu(btn.dataset.kategoria);
    });
  }

  function pokazFormularzWpisu(id) {
    const miejsce = container.querySelector(`[data-formularz="${id}"]`);
    const kierunek = mockPR[id].kierunek;
    const placeholder = kierunek === "malejaco" ? "np. 4:28 (M:SS)" : "np. 9";
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
      mockPR[id].wpisy.push({ data: new Date().toISOString().slice(0, 10), wartosc });
      render();
    };
  }

  render();
}
