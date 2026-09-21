import { pobierzAudio } from "./audio.js";
import { mockProfil, zapiszProfil } from "./state.js";

// Metronom — widget w widoku dnia, pod timerem przerwy.
//
// Stan trzymany na poziomie MODUŁU, nie widoku: metronom gra dalej przy
// przewijaniu dni i przełączaniu zakładek, a widok tylko go pokazuje.
//
// Planowanie z wyprzedzeniem (wzorzec "lookahead scheduler"): JS co jakiś
// czas wpisuje kliknięcia do osi czasu audio, a odgrywa je wątek audio —
// tempo nie zależy od dokładności setInterval. W tle przeglądarka dławi
// setInterval do ~1 s, więc wtedy planujemy z dużo większym zapasem.

const BPM_MIN = 40;
const BPM_MAX = 220;
const BPM_DOMYSLNE = 170;
const GLOSNOSC_DOMYSLNA = 40; // suwak 5–100
const KROK_BPM = 5;

const TICK_MS = 50;
const WYPRZEDZENIE_WIDOCZNY = 0.15; // s
const WYPRZEDZENIE_TLO = 2.5; // s — z zapasem na dławienie timerów w tle

let gra = false;
let ctx = null;
let wyjscie = null;
let nastepnyKlik = 0;
let schedulerId = null;
let container = null;
let zapisTimeout = null;

function ograniczBpm(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return BPM_DOMYSLNE;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, v));
}

function ograniczGlosnosc(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return GLOSNOSC_DOMYSLNA;
  return Math.min(100, Math.max(5, v));
}

function ustawienia() {
  const m = mockProfil.metronom || {};
  return { bpm: ograniczBpm(m.bpm ?? BPM_DOMYSLNE), glosnosc: ograniczGlosnosc(m.glosnosc ?? GLOSNOSC_DOMYSLNA) };
}

function zapiszUstawienia(zmiana) {
  mockProfil.metronom = { ...ustawienia(), ...zmiana };
  // Suwak strzela eventami seriami — zapis do bazy z opóźnieniem.
  if (zapisTimeout) clearTimeout(zapisTimeout);
  zapisTimeout = setTimeout(zapiszProfil, 400);
}

// Suwak liniowy → wzmocnienie kwadratowe: lepiej odpowiada słyszeniu,
// dół skali jest naprawdę cichy.
function wzmocnienie(glosnosc) {
  return Math.pow(glosnosc / 100, 2);
}

// Krótki, miękki "tik": sinus 1.2 kHz, ~35 ms, szybkie wybrzmienie.
function klik(t) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 1200;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  osc.connect(g);
  g.connect(wyjscie);
  osc.start(t);
  osc.stop(t + 0.05);
}

function planuj() {
  if (!gra || !ctx || !wyjscie) return;
  const teraz = ctx.currentTime;
  // Po wstrzymaniu kontekstu (np. połączenie) nie nadrabiamy zaległych
  // kliknięć seriami — startujemy od bieżącej chwili.
  if (nastepnyKlik < teraz) nastepnyKlik = teraz + 0.05;
  const horyzont = teraz + (document.hidden ? WYPRZEDZENIE_TLO : WYPRZEDZENIE_WIDOCZNY);
  const odstep = 60 / ustawienia().bpm;
  while (nastepnyKlik < horyzont) {
    klik(nastepnyKlik);
    nastepnyKlik += odstep;
  }
}

// Przy przejściu w tło planujemy od razu z dużym zapasem — zanim
// przeglądarka zdąży zdławić interval.
function naZmianieWidocznosci() {
  planuj();
}

function start() {
  ctx = pobierzAudio();
  if (!ctx) return;
  wyjscie = ctx.createGain();
  wyjscie.gain.value = wzmocnienie(ustawienia().glosnosc);
  wyjscie.connect(ctx.destination);
  nastepnyKlik = ctx.currentTime + 0.05;
  gra = true;
  planuj();
  schedulerId = setInterval(planuj, TICK_MS);
  document.addEventListener("visibilitychange", naZmianieWidocznosci);
}

function stop() {
  gra = false;
  if (schedulerId) clearInterval(schedulerId);
  schedulerId = null;
  document.removeEventListener("visibilitychange", naZmianieWidocznosci);
  // Odłączenie wyjścia ucina też kliknięcia już zaplanowane na przyszłość.
  if (wyjscie) {
    try {
      wyjscie.disconnect();
    } catch (err) {
      // już odłączony — ignorujemy
    }
  }
  wyjscie = null;
}

function ustawBpm(n) {
  const bpm = ograniczBpm(n);
  zapiszUstawienia({ bpm });
  // Nowe tempo od następnego kliknięcia (na pierwszym planie zapas to 0.15 s).
  odswiez();
}

function ustawGlosnosc(n) {
  const glosnosc = ograniczGlosnosc(n);
  zapiszUstawienia({ glosnosc });
  if (wyjscie && ctx) wyjscie.gain.setTargetAtTime(wzmocnienie(glosnosc), ctx.currentTime, 0.02);
}

function odswiez() {
  if (!container) return;
  const root = container.querySelector("[data-metronom-root]");
  if (!root) return;
  const { bpm } = ustawienia();
  root.classList.toggle("metronom-gra", gra);
  const toggle = root.querySelector("[data-metronom-toggle]");
  if (toggle) toggle.textContent = gra ? "Stop" : "Metronom";
  const pole = root.querySelector("[data-metronom-bpm]");
  if (pole && document.activeElement !== pole) pole.value = bpm;
}

function html() {
  const { bpm, glosnosc } = ustawienia();
  return `
    <div class="metronom ${gra ? "metronom-gra" : ""}" data-metronom-root>
      <div class="metronom-wiersz">
        <button class="metronom-toggle" data-metronom-toggle type="button">${gra ? "Stop" : "Metronom"}</button>
        <button class="metronom-krok" data-metronom-krok="-${KROK_BPM}" type="button" aria-label="Wolniej">−</button>
        <input class="metronom-bpm" data-metronom-bpm type="number" inputmode="numeric"
               min="${BPM_MIN}" max="${BPM_MAX}" step="1" value="${bpm}" aria-label="Tempo (BPM)" />
        <span class="metronom-jedn">BPM</span>
        <button class="metronom-krok" data-metronom-krok="${KROK_BPM}" type="button" aria-label="Szybciej">+</button>
      </div>
      <input class="metronom-glosnosc" data-metronom-glosnosc type="range"
             min="5" max="100" step="1" value="${glosnosc}" aria-label="Głośność metronomu" />
    </div>
  `;
}

// Wywoływać po KAŻDYM ustawieniu container.innerHTML zawierającym html().
function attach(nowyContainer) {
  container = nowyContainer;
  const root = container.querySelector("[data-metronom-root]");
  if (!root) return;

  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-metronom-toggle]")) {
      if (gra) stop();
      else start();
      odswiez();
      return;
    }
    const krok = event.target.closest("[data-metronom-krok]");
    if (krok) ustawBpm(ustawienia().bpm + Number(krok.dataset.metronomKrok));
  });

  const pole = root.querySelector("[data-metronom-bpm]");
  pole?.addEventListener("change", () => {
    ustawBpm(pole.value);
    pole.value = ustawienia().bpm; // pokaż wartość po przycięciu do zakresu
  });

  const suwak = root.querySelector("[data-metronom-glosnosc]");
  suwak?.addEventListener("input", () => ustawGlosnosc(suwak.value));

  odswiez();
}

export const metronomWidget = { html, attach };
