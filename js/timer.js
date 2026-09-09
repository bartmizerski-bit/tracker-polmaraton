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
// AudioContext tworzymy w geście usera (klik "start"), nie dopiero na końcu
// odliczania — inaczej iOS potrafi zablokować albo wyciszyć odtwarzanie.
// audioSession "playback" sprawia, że przełącznik ciszy na iPhonie nie zabija
// sygnału (iOS 16.4+; gdzie indziej po prostu nie istnieje).

let ctx = null;

function przygotujAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (err) {
    // starsze iOS / inne przeglądarki — ignorujemy
  }
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch (err) {
    ctx = null;
  }
}

// Seria ostrych piknięć. Fala "square" i okolice 2.5-3 kHz są słyszalnie
// głośniejsze od czystego sinusa przy tej samej amplitudzie — tam ucho jest
// najczulsze. Kompresor podbija poziom bez trzeszczenia.
function zagrajDzwiek() {
  try {
    przygotujAudio();
    if (!ctx) return;

    const komp = ctx.createDynamicsCompressor();
    komp.threshold.value = -18;
    komp.ratio.value = 12;
    komp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(komp);

    const pik = (start, dlugosc, freq) => {
      const gain = ctx.createGain();
      gain.connect(master);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(1, start + 0.008);
      gain.gain.setValueAtTime(1, start + dlugosc - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dlugosc);

      // Dwa lekko rozstrojone oscylatory — dudnienie dodaje słyszalności.
      [freq, freq * 1.005].forEach((f) => {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = f;
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + dlugosc + 0.02);
      });
    };

    const t0 = ctx.currentTime + 0.02;
    pik(t0, 0.14, 2600);
    pik(t0 + 0.2, 0.14, 3100);
    pik(t0 + 0.4, 0.14, 2600);
    pik(t0 + 0.6, 0.3, 3100);
  } catch (err) {
    // Brak wsparcia Web Audio API — trudno, cisza. Wibracja i tak zadziała.
  }
}

// Uwaga: Safari na iOS nie wspiera navigator.vibrate w ogóle — ani w
// przeglądarce, ani w PWA. Na Androidzie zadziała.
function zawibruj() {
  try {
    navigator.vibrate?.([400, 150, 400, 150, 600]);
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

  function zakoncz() {
    zatrzymajInterval();
    document.removeEventListener("visibilitychange", naPowrocie);
    status = "koniec";
    pozostaloSek = 0;
    zawibruj();
    zagrajDzwiek();
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
    przygotujAudio(); // odblokowanie audio w geście usera
    const dlugosc = Math.max(1, Math.round(Number(sek) || 60));
    koniecTs = Date.now() + dlugosc * 1000;
    pozostaloSek = dlugosc;
    status = "running";
    document.addEventListener("visibilitychange", naPowrocie);
    // 250 ms zamiast 1000 — wyświetlana sekunda nie kuleje po powrocie z tła.
    intervalId = setInterval(przelicz, 250);
    odswiez();
  }

  function przerwij() {
    zatrzymajInterval();
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
