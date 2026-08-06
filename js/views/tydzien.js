// Widok tygodnia — pasek 7 dni z nawigacją wstecz/wprzód,
// pod spodem szczegóły wybranego dnia (ten sam komponent co widok "Dziś").
import { toKey, addDays, getRealizacja } from "../state.js";
import { mount as mountDzien } from "./dzien.js";

function poniedzialekTygodnia(date) {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7; // 0 = poniedziałek
  return addDays(d, -offset);
}

function stanKoloru(dateKey) {
  const r = getRealizacja(dateKey);
  if (r.stan_dnia === "przerwa") return "stan-przerwa";
  if (r.stan_dnia === "len") return "stan-len";
  const wartosci = Object.values(r.kategorie || {});
  if (wartosci.length && wartosci.every((w) => w === "zrealizowany")) return "stan-pelny";
  if (wartosci.some((w) => w === "zrealizowany" || w === "czesciowo")) return "stan-czesciowy";
  return "";
}

export function mount(container) {
  let poniedzialek = poniedzialekTygodnia(new Date());
  let wybranaData = toKey(new Date());

  // Wywoływane po przesunięciu palcem w widoku dnia.
  // Gest przesuwa zawsze o jeden dzień, więc wyjście poza tydzień
  // oznacza dokładnie skok o 7 dni w odpowiednią stronę.
  function zmienDzien(nowyKlucz) {
    const pozaTygodniem = nowyKlucz < toKey(poniedzialek) || nowyKlucz > toKey(addDays(poniedzialek, 6));
    if (pozaTygodniem) {
      poniedzialek = addDays(poniedzialek, nowyKlucz > wybranaData ? 7 : -7);
    }
    wybranaData = nowyKlucz;
    render();
  }

  function render() {
    const dni = [...Array(7)].map((_, i) => addDays(poniedzialek, i));

    const paski = dni
      .map((d) => {
        const key = toKey(d);
        const aktywny = key === wybranaData ? "aktywny" : "";
        const dzienLabel = new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(d);
        return `
          <button class="dzien-pigulka ${aktywny} ${stanKoloru(key)}" data-action="wybierz-dzien" data-date="${key}">
            <span class="dzien-tyg">${dzienLabel}</span>
            <span class="dzien-num">${d.getDate()}</span>
          </button>
        `;
      })
      .join("");

    const zakresLabel = `${new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(dni[0])} – ${new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(dni[6])}`;

    container.innerHTML = `
      <div class="tydzien-nav">
        <button class="tydzien-strzalka" data-action="tydzien-wstecz" aria-label="Poprzedni tydzień">‹</button>
        <span class="tydzien-zakres">${zakresLabel}</span>
        <button class="tydzien-strzalka" data-action="tydzien-wprzod" aria-label="Następny tydzień">›</button>
      </div>
      <div class="dni-pasek">${paski}</div>
      <div id="dzien-szczegoly"></div>
    `;

    container.querySelector(".tydzien-nav").onclick = (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      if (el.dataset.action === "tydzien-wstecz") poniedzialek = addDays(poniedzialek, -7);
      if (el.dataset.action === "tydzien-wprzod") poniedzialek = addDays(poniedzialek, 7);
      render();
    };

    container.querySelector(".dni-pasek").onclick = (e) => {
      const el = e.target.closest("[data-action='wybierz-dzien']");
      if (!el) return;
      wybranaData = el.dataset.date;
      render();
    };

    mountDzien(container.querySelector("#dzien-szczegoly"), wybranaData, zmienDzien);
  }

  render();
}
