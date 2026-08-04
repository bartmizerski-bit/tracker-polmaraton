// Menu "Więcej" — huby do podwidoków, które nie mieszczą się w głównym pasku zakładek.
export function mount(container, idzDo) {
  container.innerHTML = `
    <div class="topbar"><span class="data">Więcej</span></div>
    <div class="menu-lista">
      <button class="menu-pozycja" data-target="achievementy">
        <span>Achievementy</span><span class="menu-strzalka">›</span>
      </button>
      <button class="menu-pozycja" data-target="rekordy">
        <span>Rekordy personalne</span><span class="menu-strzalka">›</span>
      </button>
      <button class="menu-pozycja" data-target="profil">
        <span>Profil i BMI</span><span class="menu-strzalka">›</span>
      </button>
      <button class="menu-pozycja" data-target="konfiguracja">
        <span>Konfiguracja i import planu</span><span class="menu-strzalka">›</span>
      </button>
    </div>
  `;

  container.querySelector(".menu-lista").onclick = (event) => {
    const btn = event.target.closest("[data-target]");
    if (!btn) return;
    idzDo(btn.dataset.target);
  };
}
