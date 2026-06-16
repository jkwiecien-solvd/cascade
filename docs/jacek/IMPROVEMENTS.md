# Cascade Improvements

Ten dokument śledzi nasze niestandardowe ulepszenia i modyfikacje wprowadzone w stosunku do oryginalnego projektu Cascade.

## Flaga `offloadToolsReference` dla silników

**Branch:** `feature/offload-tools-docs` (obecnie włączony do `dev-jacek`)

### Opis zmiany
Dodano nową opcję konfiguracyjną `offloadToolsReference` (domyślnie wyłączoną, typu boolean) do ustawień wszystkich silników AI w Cascade (Claude Code, Codex, OpenCode).
Gdy flaga jest włączona, Cascade zamiast wstrzykiwać pełną dokumentację narzędzi (Cascade Tools) bezpośrednio do systemowego prompta (co zużywa znaczną ilość tokenów), generuje plik referencyjny `.cascade/context/tools-reference.md`. W prompcie systemowym umieszczana jest jedynie krótka instrukcja odsyłająca agenta do zapoznania się z tym plikiem. Interfejs użytkownika w ustawieniach silników w Dashboardzie został automatycznie zaktualizowany, by obsługiwać tę opcję.

### Powód wprowadzenia
Rozwiązanie to pozwala na znaczną redukcję zużycia tokenów, co przekłada się na niższe koszty i potencjalnie lepsze wykorzystanie okna kontekstowego przez modele LLM, szczególnie w przypadku silników rozliczanych za zużycie tokenów. Zapobiega to przeładowaniu promptu obszernymi, stałymi instrukcjami w każdym wywołaniu agenta.
Flaga pozostaje opcjonalna (opt-in), aby zachować pełną wsteczną kompatybilność z oryginalnym zachowaniem aplikacji i pozwolić użytkownikowi na samodzielne jej włączenie.
