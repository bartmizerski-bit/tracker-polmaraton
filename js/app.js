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
let ogladanyDzien = null; // null = dzisiaj; ustawiane przez gest w zakładce "Dziś"

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

  const dzisKlucz = toKey(new Date());
  const dzienDoPokazania = ogladanyDzien || dzisKlucz;
  const pokazPowrot = aktywnaZakladka === "dzis" && dzienDoPokazania !== dzisKlucz;

  app.innerHTML = `
    ${pokazPowrot ? `<button class="wroc-dzis" data-action="wroc-dzis">↩ Wróć do dziś</button>` : ""}
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
    ogladanyDzien = null;
    renderApp();
  };

  const przyciskPowrotu = app.querySelector("[data-action='wroc-dzis']");
  if (przyciskPowrotu) {
    przyciskPowrotu.onclick = () => {
      ogladanyDzien = null;
      renderApp();
    };
  }

  const widok = document.getElementById("widok");

  if (aktywnaZakladka === "dzis") {
    mountDzien(widok, dzienDoPokazania, (nowyKlucz) => {
      ogladanyDzien = nowyKlucz;
      renderApp();
    });
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
