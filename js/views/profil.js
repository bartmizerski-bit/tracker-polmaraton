import { mockProfil, mockWpisyWagi, obliczBMI, zapiszProfil, zapiszWpisyWagi } from "../state.js";

function ostatniWpis() {
  const posortowane = [...mockWpisyWagi].sort((a, b) => (a.data > b.data ? 1 : -1));
  return posortowane[posortowane.length - 1];
}

function wykresBMI() {
  if (mockWpisyWagi.length < 2) return `<p class="brak-wykresu">Za mało wpisów na wykres BMI.</p>`;
  if (!mockProfil.wzrost_cm) return `<p class="brak-wykresu">Uzupełnij wzrost, żeby zobaczyć wykres BMI.</p>`;

  const posortowane = [...mockWpisyWagi].sort((a, b) => (a.data > b.data ? 1 : -1));
  const wartosciBMI = posortowane.map((w) => obliczBMI(w.waga_kg, mockProfil.wzrost_cm));

  const min = Math.min(...wartosciBMI);
  const max = Math.max(...wartosciBMI);
  const zakres = max - min || 1;
  const szer = 280;
  const wys = 70;
  const margines = 8;

  const punkty = wartosciBMI
    .map((y, i) => {
      const x = margines + (i / (wartosciBMI.length - 1)) * (szer - margines * 2);
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

export function mount(container, wroc) {
  function render() {
    const ostatni = ostatniWpis();
    const bmi = ostatni && mockProfil.wzrost_cm ? obliczBMI(ostatni.waga_kg, mockProfil.wzrost_cm) : null;

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wroc">‹ Więcej</button>
      <div class="topbar"><span class="data">Profil</span></div>

      <div class="fixed-row">
        <div class="fixed-item">
          <label for="wzrost-input">Wzrost (cm)</label>
          <input id="wzrost-input" class="km-input" type="number" value="${mockProfil.wzrost_cm}" data-field="wzrost" />
        </div>
        <div class="fixed-divider"></div>
        <div class="fixed-item">
          <label for="wiek-input">Wiek</label>
          <input id="wiek-input" class="km-input" type="number" value="${mockProfil.wiek}" data-field="wiek" />
        </div>
      </div>

      <div class="stat-grid-duze">
        <div class="stat-card duzy">
          <span class="stat-value">${ostatni ? ostatni.waga_kg.toFixed(1) : "–"}</span>
          <span class="stat-label">Ostatnia waga (kg)</span>
        </div>
        <div class="stat-card duzy">
          <span class="stat-value">${bmi ? bmi.toFixed(1) : "–"}</span>
          <span class="stat-label">BMI</span>
        </div>
      </div>

      <button class="dodaj-btn" data-action="pokaz-formularz">+ Dodaj dzisiejszy pomiar</button>
      <div id="waga-formularz"></div>

      <div class="sekcja-naglowek">BMI w czasie</div>
      <div class="pr-card">${wykresBMI()}</div>
    `;

    container.querySelector("[data-action='wroc']").onclick = wroc;
    container.querySelector("[data-action='pokaz-formularz']").onclick = pokazFormularz;

    container.querySelectorAll("[data-field]").forEach((input) => {
      input.onchange = (e) => {
        const pole = e.target.dataset.field === "wzrost" ? "wzrost_cm" : "wiek";
        mockProfil[pole] = Number(e.target.value);
        zapiszProfil();
        render();
      };
    });
  }

  function pokazFormularz() {
    const miejsce = container.querySelector("#waga-formularz");
    miejsce.innerHTML = `
      <div class="mini-formularz">
        <input type="number" step="0.1" id="waga-input" placeholder="kg" />
        <button data-action="zapisz-wage">Zapisz</button>
      </div>
    `;
    miejsce.querySelector("[data-action='zapisz-wage']").onclick = () => {
      const wartosc = parseFloat(miejsce.querySelector("#waga-input").value);
      if (!wartosc) return;
      const dzis = new Date().toISOString().slice(0, 10);
      const istniejacy = mockWpisyWagi.find((w) => w.data === dzis);
      if (istniejacy) istniejacy.waga_kg = wartosc;
      else mockWpisyWagi.push({ data: dzis, waga_kg: wartosc });
      zapiszWpisyWagi();
      render();
    };
  }

  render();
}
