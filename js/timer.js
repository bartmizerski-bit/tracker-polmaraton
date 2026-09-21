import { pobierzAudio } from "./audio.js";

// Widget timera przerwy — montowany nad kafelkami w widoku dnia.
// Stan (odliczanie) trzymany jest w domknięciu, niezależnie od DOM, dzięki
// czemu przeżywa wielokrotne re-rendery widoku dnia (dzien.js podmienia całe
// container.innerHTML przy każdej akcji — tristate, km marszu itd.).
//
// Odliczanie liczone jest z TIMESTAMPU KOŃCA, nie przez odejmowanie sekundy
// co tick. Przeglądarka dławi setInterval w tle i przy zgaszonym ekranie —
// dekrementacja by się rozjeżdżała, liczenie z zegara nie.

function formatujCzas(sek) {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// --- Dźwięk ---------------------------------------------------------------
// Sygnał końca planujemy w ZEGARZE AUDIO już w momencie startu
// (osc.start(czasKonca)), a nie wywołujemy z JS po upływie czasu. Android
// usypia JavaScript przy zgaszonym ekranie, ale wątek audio gra dalej —
// dlatego sygnał odzywa się punktualnie także przy zablokowanym telefonie.

// Łagodny, trzytonowy gong: czyste sinusy + słaba oktawa dla słyszalności,
// miękkie wejście i wybrzmienie. Zwraca węzeł wyjściowy — jego odłączenie
// anuluje zaplanowany (jeszcze niezagrany) sygnał.
function zaplanujGong(ctx, t0) {
  const wyjscie = ctx.createGain();
  wyjscie.gain.value = 0.45;
  wyjscie.connect(ctx.destination);

  const ton = (start, freq) => {
    const obwiednia = ctx.createGain();
    obwiednia.connect(wyjscie);
    obwiednia.gain.setValueAtTime(0.0001, start);
    obwiednia.gain.exponentialRampToValueAtTime(1, start + 0.015);
    obwiednia.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);

    [
      [freq, 1],
      [freq * 2, 0.25],
    ].forEach(([f, amp]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.value = amp;
      osc.connect(g);
      g.connect(obwiednia);
      osc.start(start);
      osc.stop(start + 0.95);
    });
  };

  ton(t0, 880);
  ton(t0 + 0.3, 1175);
  ton(t0 + 0.6, 1568);
  return wyjscie;
}

// Uwaga: Safari na iOS nie wspiera navigator.vibrate w ogóle — ani w
// przeglądarce, ani w PWA. Na Androidzie zadziała.
function zawibruj() {
  try {
    navigator.vibrate?.([300, 150, 300]);
  } catch (err) {
    // brak wsparcia — ignorujemy
  }
}

// --- Widget ---------------------------------------------------------------

const PRESETY_DOMYSLNE = [30, 60, 90];

// pobierzPresety — funkcja zwracająca aktualną tablicę presetów (odczytywana
// na żywo przy renderze, żeby zmiana w Konfiguracji działała bez przeładowania).
export function createTimerWidget(pobierzPresety) {
  let status = "idle"; // idle | running | koniec
  let koniecTs = 0;
  let pozostaloSek = 0;
  let intervalId = null;
  let timeoutKoniec = null;
  let container = null;
  // Sygnał zaplanowany w zegarze audio: { ctx, czasAudio, wyjscie }
  let gong = null;

  function presety() {
    const lista = pobierzPresety?.();
    if (!Array.isArray(lista) || !lista.length) return PRESETY_DOMYSLNE;
    const oczyszczone = lista.map((n) => Math.max(1, Math.round(Number(n) || 0))).filter(Boolean);
    return oczyszczone.length ? oczyszczone : PRESETY_DOMYSLNE;
  }

  function znajdzElementy() {
    if (!container) return {};
    return {
      root: container.querySelector("[data-timer-root]"),
      wiersz: container.querySelector("[data-timer-presety]"),
      bieg: container.querySelector("[data-timer-bieg]"),
      czas: container.querySelector("[data-timer-czas]"),
    };
  }

  function odswiez() {
    const el = znajdzElementy();
    if (!el.root) return; // widok przerenderowany bez timera na ekranie

    el.root.classList.toggle("timer-running", status === "running");
    el.root.classList.toggle("timer-koniec", status === "koniec");

    const wTrakcie = status === "running";
    if (el.wiersz) el.wiersz.hidden = wTrakcie;
    if (el.bieg) el.bieg.hidden = !wTrakcie;
    if (el.czas) el.czas.textContent = formatujCzas(pozostaloSek);
  }

  function zatrzymajInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  // Liczymy z zegara, nie przez dekrementację — odporne na dławienie w tle.
  function przelicz() {
    const zostalo = Math.max(0, Math.ceil((koniecTs - Date.now()) / 1000));
    pozostaloSek = zostalo;
    if (zostalo <= 0 && status === "running") {
      zakoncz();
      return;
    }
    odswiez();
  }

  function anulujGong() {
    if (!gong) return;
    try {
      gong.wyjscie.disconnect();
    } catch (err) {
      // już odłączony — ignorujemy
    }
    gong = null;
  }

  function zakoncz() {
    zatrzymajInterval();
    document.removeEventListener("visibilitychange", naPowrocie);
    status = "koniec";
    pozostaloSek = 0;
    zawibruj();
    // Jeśli zegar audio stał (np. kontekst wstrzymany przez system w tle),
    // zaplanowany gong jeszcze nie zagrał — gramy go od razu. Jeśli zagrał
    // albo właśnie gra, nic nie dublujemy.
    if (gong && gong.ctx.currentTime < gong.czasAudio - 0.3) {
      const ctx = gong.ctx;
      anulujGong();
      zaplanujGong(ctx, ctx.currentTime + 0.05);
    }
    gong = null;
    odswiez();
    // Po chwili wracamy do rzędu presetów — bez dodatkowego klikania.
    if (timeoutKoniec) clearTimeout(timeoutKoniec);
    timeoutKoniec = setTimeout(() => {
      if (status !== "koniec") return;
      status = "idle";
      odswiez();
    }, 3000);
  }

  function start(sek) {
    zatrzymajInterval();
    if (timeoutKoniec) clearTimeout(timeoutKoniec);
    anulujGong();
    const dlugosc = Math.max(1, Math.round(Number(sek) || 60));
    koniecTs = Date.now() + dlugosc * 1000;
    // Kontekst tworzony w geście usera; gong od razu wpięty w oś czasu audio.
    const ctx = pobierzAudio();
    if (ctx) {
      try {
        const czasAudio = ctx.currentTime + dlugosc;
        gong = { ctx, czasAudio, wyjscie: zaplanujGong(ctx, czasAudio) };
      } catch (err) {
        gong = null;
      }
    }
    pozostaloSek = dlugosc;
    status = "running";
    document.addEventListener("visibilitychange", naPowrocie);
    // 250 ms zamiast 1000 — wyświetlana sekunda nie kuleje po powrocie z tła.
    intervalId = setInterval(przelicz, 250);
    odswiez();
  }

  function przerwij() {
    zatrzymajInterval();
    anulujGong();
    document.removeEventListener("visibilitychange", naPowrocie);
    if (timeoutKoniec) clearTimeout(timeoutKoniec);
    status = "idle";
    pozostaloSek = 0;
    odswiez();
  }

  // Powrót z tła: przelicz natychmiast, nie czekaj na tick. Listener żyje
  // tylko w trakcie odliczania — widget powstaje na nowo przy każdym mount()
  // dnia, więc stała rejestracja na document by się mnożyła przy przewijaniu.
  function naPowrocie() {
    if (document.visibilityState === "visible" && status === "running") przelicz();
  }

  function html() {
    const przyciski = presety()
      .map((sek) => `<button class="timer-btn" data-timer-start="${sek}" type="button">${sek} s</button>`)
      .join("");

    return `
      <div class="timer-przerwy" data-timer-root>
        <div class="timer-presety" data-timer-presety>${przyciski}</div>
        <div class="timer-bieg" data-timer-bieg hidden>
          <span class="timer-czas" data-timer-czas>0:00</span>
          <button class="timer-btn timer-btn-przerwij" data-timer-przerwij type="button">Przerwij</button>
        </div>
      </div>
    `;
  }

  // Wywoływać po KAŻDYM ustawieniu container.innerHTML zawierającym html()
  // powyżej — podpina listener i synchronizuje wyświetlany stan.
  function attach(nowyContainer) {
    container = nowyContainer;
    const root = container.querySelector("[data-timer-root]");
    if (root) {
      root.addEventListener("click", (event) => {
        const startBtn = event.target.closest("[data-timer-start]");
        if (startBtn) {
          start(startBtn.dataset.timerStart);
          return;
        }
        if (event.target.closest("[data-timer-przerwij]")) przerwij();
      });
    }
    if (status === "running") przelicz();
    else odswiez();
  }

  return { html, attach };
}
