// Punkt wejścia — rejestracja service workera + przełączanie zakładek/podwidoków.
import { toKey, inicjalizujStan } from "./state.js";
import { mount as mountDzien } from "./views/dzien.js";
import { mount as mountTydzien } from "./views/tydzien.js";
import { mount as mountStatystyki } from "./views/statystyki.js";
import { mount as mountWiecej } from "./views/wiecej.js";
import { mount as mountAchievementy } from "./views/achievementy.js";
import { mount as mountRekordy } from "./views/rekordy.js";
import { mount as mountProfil } from "./views/profil.js";
import { mount as mountKonfiguracja } from "./views/konfiguracja.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Rejestracja service workera nie powiodła się:", err);
    });
  });
}

const TABS = [
  { id: "dzis", label: "Dziś" },
  { id: "tydzien", label: "Tydzień" },
  { id: "statystyki", label: "Statystyki" },
  { id: "wiecej", label: "Więcej" },
];

let aktywnaZakladka = "dzis";
let podWidok = null; // null | "achievementy" | "rekordy" | "profil" | "konfiguracja"

function idzDoPodwidoku(nazwa) {
  podWidok = nazwa;
  renderApp();
}

function wrocDoMenu() {
  podWidok = null;
  renderApp();
}

function renderApp() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <div id="widok"></div>
    <nav class="tab-bar">
      ${TABS.map(
        (t) => `<button class="tab-btn ${t.id === aktywnaZakladka ? "aktywny" : ""}" data-tab="${t.id}">${t.label}</button>`
      ).join("")}
    </nav>
  `;

  app.querySelector(".tab-bar").onclick = (event) => {
    const btn = event.target.closest("[data-tab]");
    if (!btn) return;
    aktywnaZakladka = btn.dataset.tab;
    podWidok = null;
    renderApp();
  };

  const widok = document.getElementById("widok");

  if (aktywnaZakladka === "dzis") {
    mountDzien(widok, toKey(new Date()));
  } else if (aktywnaZakladka === "tydzien") {
    mountTydzien(widok);
  } else if (aktywnaZakladka === "statystyki") {
    mountStatystyki(widok);
  } else if (aktywnaZakladka === "wiecej") {
    if (podWidok === "achievementy") mountAchievementy(widok, wrocDoMenu);
    else if (podWidok === "rekordy") mountRekordy(widok, wrocDoMenu);
    else if (podWidok === "profil") mountProfil(widok, wrocDoMenu);
    else if (podWidok === "konfiguracja") mountKonfiguracja(widok, wrocDoMenu);
    else mountWiecej(widok, idzDoPodwidoku);
  }
}

inicjalizujStan().finally(renderApp);
