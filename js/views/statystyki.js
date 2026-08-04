// Widok statystyk — dane na sztywno (mock), docelowo liczone
// na bazie zapisanej realizacji z IndexedDB.
const CATEGORY_LABELS = {
  bieganie: "Bieganie",
  drazki: "Drążki",
  dom: "Dom",
  sporty_walki: "Sporty walki",
};

const mockStats = {
  passaAktualna: 6,
  passaNajdluzsza: 14,
  sumaKm: 47.8,
  sesje: { bieganie: 9, drazki: 5, dom: 3, sporty_walki: 4 },
  realizacjaTygodni: [40, 55, 60, 70, 65, 80, 90, 75], // % z ostatnich 8 tygodni
};

export function mount(container) {
  const paski = mockStats.realizacjaTygodni
    .map(
      (proc, i) => `
      <div class="bar-col">
        <div class="bar" style="height:${proc}%"></div>
        <span class="bar-label">${i + 1}</span>
      </div>
    `
    )
    .join("");

  const sesje = Object.entries(mockStats.sesje)
    .map(
      ([kat, n]) => `
      <div class="stat-card">
        <span class="stat-value">${n}</span>
        <span class="stat-label">${CATEGORY_LABELS[kat]}</span>
      </div>
    `
    )
    .join("");

  container.innerHTML = `
    <div class="topbar"><span class="data">Statystyki</span></div>

    <div class="stat-grid-duze">
      <div class="stat-card duzy">
        <span class="stat-value">${mockStats.passaAktualna}</span>
        <span class="stat-label">Aktualna passa</span>
      </div>
      <div class="stat-card duzy">
        <span class="stat-value">${mockStats.passaNajdluzsza}</span>
        <span class="stat-label">Najdłuższa passa</span>
      </div>
    </div>

    <div class="stat-card szeroki">
      <span class="stat-value">${mockStats.sumaKm.toFixed(1)} km</span>
      <span class="stat-label">Suma marszu</span>
    </div>

    <div class="sekcja-naglowek">Sesje</div>
    <div class="stat-grid">${sesje}</div>

    <div class="sekcja-naglowek">Realizacja planu — ostatnie 8 tygodni</div>
    <div class="bar-chart">${paski}</div>
  `;
}
