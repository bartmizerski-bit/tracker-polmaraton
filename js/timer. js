// Widget timera przerwy — montowany nad kafelkami "Drążki"/"Dom" w widoku dnia.
// Stan (odliczanie) trzymany jest w domknięciu, niezależnie od DOM, dzięki
// czemu przeżywa wielokrotne re-rendery widoku dnia (dzien.js podmienia całe
// container.innerHTML przy każdej akcji — tristate, km marszu itd.).

function formatujCzas(sek) {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Krótki, dwutonowy sygnał końca przerwy — bez pliku audio, samym Web Audio API.
function zagrajDzwiek() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const zagrajTon = (freq, startOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + startOffset;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.start(start);
      osc.stop(start + 0.5);
    };
    zagrajTon(880, 0);
    zagrajTon(1046, 0.18);
    setTimeout(() => ctx.close(), 900);
  } catch (err) {
    // Brak wsparcia Web Audio API — trudno, cisza. Wibracja i tak zadziała.
  }
}

function zawibruj() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch (err) {
    // brak wsparcia — ignorujemy
  }
}

// pobierzDomyslneSek — funkcja zwracająca aktualną domyślną długość przerwy
// (odczytywana na żywo przy starcie, żeby zmiana w Konfiguracji działała bez
// przeładowania widoku).
export function createTimerWidget(pobierzDomyslneSek) {
  let status = "idle"; // idle | running | done
  let pozostaloSek = 0;
  let intervalId = null;
  let container = null;

  function znajdzElementy() {
    if (!container) return {};
    return {
      root: container.querySelector("[data-timer-root]"),
      przycisk: container.querySelector("[data-timer-action]"),
      czas: container.querySelector("[data-timer-czas]"),
    };
  }

  function odswiez() {
    const { root, przycisk, czas } = znajdzElementy();
    if (!root) return; // widok przerenderowany bez timera na ekranie
    root.classList.toggle("timer-running", status === "running");
    root.classList.toggle("timer-done", status === "done");
    if (czas) czas.textContent = status === "idle" ? "" : formatujCzas(pozostaloSek);
    if (przycisk) {
      przycisk.textContent =
        status === "running" ? "Przerwij" : status === "done" ? "Jeszcze raz" : "Start przerwy";
    }
  }

  function zatrzymajInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  function tick() {
    pozostaloSek -= 1;
    if (pozostaloSek <= 0) {
      pozostaloSek = 0;
      zatrzymajInterval();
      status = "done";
      zawibruj();
      zagrajDzwiek();
    }
    odswiez();
  }

  function start() {
    zatrzymajInterval();
    pozostaloSek = Math.max(1, Number(pobierzDomyslneSek()) || 60);
    status = "running";
    intervalId = setInterval(tick, 1000);
    odswiez();
  }

  function przerwij() {
    zatrzymajInterval();
    status = "idle";
    pozostaloSek = 0;
    odswiez();
  }

  function html() {
    return `
      <div class="timer-przerwy" data-timer-root>
        <button class="timer-btn" data-timer-action type="button">Start przerwy</button>
        <span class="timer-czas" data-timer-czas></span>
      </div>
    `;
  }

  // Wywoływać po KAŻDYM ustawieniu container.innerHTML zawierającym html()
  // powyżej — podpina listener i synchronizuje wyświetlany stan.
  function attach(nowyContainer) {
    container = nowyContainer;
    const { przycisk } = znajdzElementy();
    if (przycisk) {
      przycisk.onclick = () => {
        if (status === "running") przerwij();
        else start();
      };
    }
    odswiez();
  }

  return { html, attach };
}
