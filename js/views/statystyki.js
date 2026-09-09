// Widok statystyk — liczone na żywo z realnie zapisanej realizacji.
// Nie zna nazw kategorii: etykiety bierze ze wspólnej funkcji w state.js.
import {
  obliczPasse,
  obliczSumeKm,
  obliczSesje,
  obliczPasseMichy,
  obliczDniPrzerwy,
  obliczDniLen,
  obliczProcentRealizacjiPlanu,
} from "../obliczenia.js";
import { etykietaKategorii } from "../state.js";

export function mount(container) {
  const { aktualna, najdluzsza } = obliczPasse();
  const sumaKm = obliczSumeKm();
  const sesje = obliczSesje();
  const passaMichy = obliczPasseMichy();
  const dniPrzerwy = obliczDniPrzerwy();
  const dniLen = obliczDniLen();
  const procentRealizacji = obliczProcentRealizacjiPlanu();

  const wpisySesji = Object.entries(sesje).sort((a, b) => b[1] - a[1]);
  const sesjeHtml = wpisySesji.length
    ? wpisySesji
        .map(
          ([kat, n]) => `
      <div class="stat-card">
        <span class="stat-value">${n}</span>
        <span class="stat-label">${etykietaKategorii(kat)}</span>
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
  `;
}
