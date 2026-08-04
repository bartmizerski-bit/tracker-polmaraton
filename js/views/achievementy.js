import { mockAchievementyAutomatyczne, mockAchievementyWlasne } from "../state.js";

export function mount(container, wroc) {
  function render() {
    const automatyczne = mockAchievementyAutomatyczne
      .map(
        (a) => `
        <div class="ach-item ${a.odblokowany ? "odblokowany" : "zablokowany"}">
          <div class="ach-znacznik">${a.odblokowany ? "✓" : "–"}</div>
          <div class="ach-tresc">
            <span class="ach-nazwa">${a.nazwa}</span>
            <span class="ach-opis">${a.opis}</span>
          </div>
        </div>
      `
      )
      .join("");

    const wlasne = mockAchievementyWlasne.length
      ? mockAchievementyWlasne
          .map(
            (a) => `
        <div class="ach-item odblokowany">
          <div class="ach-znacznik">✓</div>
          <div class="ach-tresc">
            <span class="ach-nazwa">${a.nazwa}</span>
            ${a.opis ? `<span class="ach-opis">${a.opis}</span>` : ""}
          </div>
        </div>
      `
          )
          .join("")
      : `<p class="pusta-lista">Jeszcze nic tu nie ma.</p>`;

    container.innerHTML = `
      <button class="cofnij-btn" data-action="wroc">‹ Więcej</button>
      <div class="topbar"><span class="data">Achievementy</span></div>

      <div class="sekcja-naglowek">Automatyczne</div>
      <div class="ach-lista">${automatyczne}</div>

      <div class="sekcja-naglowek">Własne</div>
      <div class="ach-lista">${wlasne}</div>

      <button class="dodaj-btn" data-action="pokaz-formularz">+ Dodaj własny</button>
      <div id="ach-formularz"></div>
    `;

    container.querySelector("[data-action='wroc']").onclick = wroc;
    container.querySelector("[data-action='pokaz-formularz']").onclick = pokazFormularz;
  }

  function pokazFormularz() {
    const miejsce = container.querySelector("#ach-formularz");
    miejsce.innerHTML = `
      <div class="mini-formularz">
        <input type="text" id="ach-nazwa" placeholder="Nazwa achievementu" />
        <input type="text" id="ach-opis" placeholder="Opis (opcjonalnie)" />
        <button data-action="zapisz-ach">Zapisz</button>
      </div>
    `;
    miejsce.querySelector("[data-action='zapisz-ach']").onclick = () => {
      const nazwa = miejsce.querySelector("#ach-nazwa").value.trim();
      if (!nazwa) return;
      const opis = miejsce.querySelector("#ach-opis").value.trim();
      mockAchievementyWlasne.push({
        id: `custom_${Date.now()}`,
        nazwa,
        opis,
        data: new Date().toISOString().slice(0, 10),
      });
      render();
    };
  }

  render();
}
