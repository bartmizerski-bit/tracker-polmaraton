# Jak wystawić apkę w internecie (krok po kroku)

Ten szkielet nie wymaga żadnego "budowania" ani instalowania programów — to gotowe pliki, które wystarczy umieścić na GitHub, a strona zacznie działać sama.

## 1. Załóż konto na GitHub (jeśli jeszcze nie masz)

Wejdź na github.com i załóż darmowe konto.

## 2. Stwórz nowe repozytorium (czyli "folder projektu" na GitHubie)

- Kliknij zielony przycisk **"New"** (albo "+" w prawym górnym rogu → "New repository").
- Nazwa np. `tracker-polmaraton`.
- Ustaw jako **Public** (musi być publiczne, żeby GitHub Pages zadziałało za darmo).
- Nie zaznaczaj żadnych dodatkowych opcji (README itp.) — zostaw puste.
- Kliknij **"Create repository"**.

## 3. Wgraj pliki

Na stronie nowo utworzonego repozytorium:
- Kliknij **"uploading an existing file"** (albo "Add file" → "Upload files").
- Przeciągnij tam **całą zawartość** tego folderu (wszystkie pliki i podfoldery: `index.html`, `manifest.json`, `sw.js`, folder `css`, folder `js`, folder `icons`).
- Ważne: struktura folderów musi zostać zachowana (np. `css/style.css`, nie `style.css` osobno).
- Na dole kliknij **"Commit changes"** (to jest po prostu "zapisz").

## 4. Włącz GitHub Pages

- W repozytorium wejdź w **Settings** (górne menu repozytorium).
- Z lewego menu wybierz **Pages**.
- W sekcji "Build and deployment" → "Branch" wybierz: **main** i folder **/ (root)**.
- Kliknij **Save**.
- Poczekaj minutę–dwie, odśwież stronę — pojawi się link w stylu:
  `https://twoja-nazwa.github.io/tracker-polmaraton/`

## 5. Sprawdź, czy działa

- Otwórz ten link na telefonie (w Chrome na Androidzie albo Safari na iOS).
- Powinieneś zobaczyć napis "Po co mi to było — Szkielet techniczny gotowy".
- Na Androidzie: powinna pojawić się opcja "Dodaj do ekranu głównego" / "Zainstaluj aplikację".
- Na iOS: w Safari kliknij ikonę udostępniania → "Dodaj do ekranu początkowego".

## 6. Jak wprowadzać poprawki w przyszłości

Najprościej: w repozytorium na GitHubie otwórz plik, który chcesz zmienić, kliknij ikonę ołówka (Edit), popraw treść, kliknij "Commit changes" na dole. Strona zaktualizuje się automatycznie w ciągu chwili.

W praktyce: będziemy razem pracować nad kolejnymi plikami tutaj, na czacie — ja przygotuję zaktualizowaną wersję pliku, a Ty podmienisz go na GitHubie tą samą metodą (Edit → wklej nową treść → Commit).

## Co dalej

Ten szkielet to tylko "powłoka" — instalowalna, działająca offline strona, jeszcze bez właściwej funkcjonalności (checkboxy, statystyki itd.). Kolejny krok to dobudowanie prawdziwego interfejsu i logiki na bazie tego, co ustaliliśmy w dokumencie wiedzy.
