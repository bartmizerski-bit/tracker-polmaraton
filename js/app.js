// Punkt wejścia — rejestracja service workera + przełączanie zakładek/podwidoków.
// Przycisk "wstecz" (device/przeglądarka) jest spięty z History API, żeby
// nie zamykał apki, tylko cofał: z podwidoku "Więcej" o jeden krok do menu,
// a z każdej innej zakładki — od razu do widoku głównego.
import { inicjalizujStan } from "./state.js";
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
  { id: "tydzien", label: "Tydzień" },
  { id: "statystyki", label: "Statystyki" },
  { id: "wiecej", label: "Więcej" },
];

let aktywnaZakladka = "tydzien";
let podWidok = null; // null | "achievementy" | "rekordy" | "profil" | "konfiguracja"

// Nawigacja odłożona na czas cofania się do widoku głównego (patrz nawigujDoTab).
let pendingNavigacja = null;

function glebokosc(tab, sub) {
  if (sub) return 2;
  if (tab !== "tydzien") return 1;
  return 0;
}

function ustawStanIRenderuj(tab, sub) {
  aktywnaZakladka = tab;
  podWidok = sub;
  renderApp();
}

function nawigujDoTab(tab) {
  const obecna = glebokosc(aktywnaZakladka, podWidok);
  const docelowa = glebokosc(tab, null);

  if (obecna === 0 && docelowa === 0) return; // już jesteśmy w domu

  if (docelowa === 0) {
    // powrót do widoku głównego — cofnij się w historii o tyle poziomów,
    // ile faktycznie odłożyliśmy (1 albo 2); stan zaaplikuje popstate
    history.go(-obecna);
    return;
  }

  if (obecna === 0) {
    // pierwsze wyjście z widoku głównego
    ustawStanIRenderuj(tab, null);
    history.pushState({ tab, sub: null }, "");
    return;
  }

  if (obecna === 2) {
    // jesteśmy w podwidoku "Więcej" i skaczemy na inną zakładkę —
    // najpierw wróć w historii do widoku głównego, docelowy stan
    // dograj dopiero po dojściu tam (patrz listener popstate)
    pendingNavigacja = { tab, sub: null };
    history.go(-obecna);
    return;
  }

  // obecna === 1, docelowa === 1 — zwykła zmiana zakładki na tym samym poziomie
  ustawStanIRenderuj(tab, null);
  history.replaceState({ tab, sub: null }, "");
}

function idzDoPodwidoku(nazwa) {
  ustawStanIRenderuj(aktywnaZakladka, nazwa);
  history.pushState({ tab: aktywnaZakladka, sub: nazwa }, "");
}

function wrocDoMenu() {
  history.back();
}

window.addEventListener("popstate", (event) => {
  const stan = event.state || { tab: "tydzien", sub: null };
  ustawStanIRenderuj(stan.tab, stan.sub);

  if (pendingNavigacja && glebokosc(stan.tab, stan.sub) === 0) {
    const cel = pendingNavigacja;
    pendingNavigacja = null;
    ustawStanIRenderuj(cel.tab, cel.sub);
    history.pushState(cel, "");
  }
});

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
    nawigujDoTab(btn.dataset.tab);
  };

  const widok = document.getElementById("widok");

  if (aktywnaZakladka === "tydzien") {
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

history.replaceState({ tab: aktywnaZakladka, sub: null }, "");
inicjalizujStan().finally(renderApp);
