// Punkt wejścia — rejestracja service workera + przełączanie zakładek.
import { toKey } from "./state.js";
import { mount as mountDzien } from "./views/dzien.js";
import { mount as mountTydzien } from "./views/tydzien.js";
import { mount as mountStatystyki } from "./views/statystyki.js";

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
];

let aktywnaZakladka = "dzis";

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
    renderApp();
  };

  const widok = document.getElementById("widok");
  if (aktywnaZakladka === "dzis") mountDzien(widok, toKey(new Date()));
  else if (aktywnaZakladka === "tydzien") mountTydzien(widok);
  else if (aktywnaZakladka === "statystyki") mountStatystyki(widok);
}

renderApp();
