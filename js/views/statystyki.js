// Widok statystyk — liczone na żywo z realnie zapisanej realizacji.
import {
  obliczPasse,
  obliczSumeKm,
  obliczSesje,
  obliczRealizacjeTygodni,
  obliczPasseMichy,
  obliczDniPrzerwy,
  obliczDniLen,
  obliczSumeKalorii,
  obliczProcentRealizacjiPlanu,
} from "../obliczenia.js";

const CATEGORY_LABELS = {
  bieganie: "Bieganie",
  drazki: "Drążki",
  dom: "Dom",
  sporty_walki: "Sporty walki",
  silownia: "Siłownia",
};

export function mount(container) {
  const { aktualna, najdluzsza } = obliczPasse();
  const sumaKm = obliczSumeKm();
  const sesje = obliczSesje();
  const realizacjaTygodni = obliczRealizacjeTygodni(8);
  const passaMichy = obliczPasseMichy();
  const dniPrzerwy = obliczDniPrzerwy();
  const dniLen = obliczDniLen();
  const sumaKalorii = obliczSumeKalorii();
  const procentRealizacji = obliczProcentRealizacjiPlanu();

  const paski = realizacjaTygodni
    .map(
      (proc, i) => `
      <div class="bar-col">
        <div class="bar" style="height:${Math.max(proc, 2)}%"></div>
        <span class="bar-label">${i + 1}</span>
      </div>
    `
    )
    .join("");

  const wpisySesji = Object.entries(sesje);
  const sesjeHtml = wpisySesji.length
    ? wpisySesji
        .map(
          ([kat, n]) => `
      <div class="stat-card">
        <span class="stat-value">${n}</span>
        <span class="stat-label">${CATEGORY_LABELS[kat] || kat}</span>
      </div>
    `
        )
        .join("")
    : `<p class="pusta-lista">Jeszcze żadnej odhaczonej sesji.</p>`;

  container.innerHTML = `
    <div class="topbar"><span class="data">Statystyki</span></div>

    <div class="stat-grid-duze">
      <div class="stat-card duzy">
        <span class="stat-value">${aktualna}</span>
        <span class="stat-label">Aktualna passa</span>
      </div>
      <div class="stat-card duzy">
        <span class="stat-value">${najdluzsza}</span>
        <span class="stat-label">Najdłuższa passa</span>
      </div>
    </div>

    <div class="stat-card szeroki">
      <span class="stat-value">${procentRealizacji}%</span>
      <span class="stat-label">Realizacja planu od startu</span>
    </div>

    <div class="stat-card szeroki">
      <span class="stat-value">${sumaKm.toFixed(1)} km</span>
      <span class="stat-label">Suma marszu</span>
    </div>

    <div class="stat-card szeroki">
      <span class="stat-value">${sumaKalorii} kcal</span>
      <span class="stat-label">Suma spalonych kalorii</span>
    </div>

    <div class="sekcja-naglowek">Sesje</div>
    <div class="stat-grid">${sesjeHtml}</div>

    <div class="sekcja-naglowek">Trzymanie michy</div>
    <div class="stat-grid-duze">
      <div class="stat-card duzy">
        <span class="stat-value">${passaMichy.aktualna}</span>
        <span class="stat-label">Aktualna passa</span>
      </div>
      <div class="stat-card duzy">
        <span class="stat-value">${passaMichy.najdluzsza}</span>
        <span class="stat-label">Najdłuższa passa</span>
      </div>
    </div>

    <div class="sekcja-naglowek">Dni specjalne</div>
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-value">${dniPrzerwy}</span>
        <span class="stat-label">Dni przerwy</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${dniLen}</span>
        <span class="stat-label">Dni lenia</span>
      </div>
    </div>

    <div class="sekcja-naglowek">Realizacja planu — ostatnie 8 tygodni</div>
    <div class="bar-chart">${paski}</div>
  `;
}
