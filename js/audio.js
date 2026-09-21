// Wspólny AudioContext dla timera i metronomu.
// Jeden kontekst zamiast dwóch: działający metronom trzyma zegar audio
// w ruchu, co dodatkowo zabezpiecza zaplanowany sygnał końca przerwy.
//
// Kontekst tworzymy / wznawiamy w geście usera (klik), inaczej przeglądarka
// może zablokować odtwarzanie.

let ctx = null;

export function pobierzAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (err) {
    // brak wsparcia — ignorujemy
  }
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch (err) {
    ctx = null;
  }
  return ctx;
}
