# Design system e interfacce

## Direzione visiva

L'immagine `assets/reference-design.webp` costituisce il riferimento iniziale di **composizione**: card morbide e sovrapposte, informazioni sportive a rilievo lieve, superfici traslucide, navigazione mobile dedicata e schede match enfatizzate. La palette è intenzionalmente modificata rispetto all'immagine: le tonalità verdine vengono reinterpretate come nero grafite e le zone chiare diventano bianco tenue / giallo acido controllato.

| Token | Valore | Uso |
|---|---|---|
| Background | `#090b0a` | Sfondo scuro, dominante |
| Panel | `rgba(27,31,26,.70)` | Vetro opaco / overlay |
| Surface | `#171b17` | Pannelli e modali |
| Foreground | `#f4f6ee` | Titoli e testi primari |
| Muted | `#a0a7a0` | Testi ausiliari |
| Accent | `#e3ff65` | Selezioni, punteggi, KPI |
| Border | `rgba(231,255,198,.13)` | Delimitazioni leggere |

Nessun effetto neon invasivo. Ombre profonde, bordi sottili e blur moderato. Angoli medi, senza pill su ogni componente. Contenuti sportivi reali prima degli effetti decorativi.

## Desktop

- Sidebar persistente compatta da 208px.
- Barra superiore contestuale (sezione, stato sync, refresh).
- Home a due colonne editoriali, carosello match spotlight, tabella classifica e KPI.
- Competizioni con classifica e calendario affiancati quando c'è spazio.
- Match Center in dialog consultivo unificato, con tre tab.

## Mobile (prima classe)

- Breakpoint principale 800px, design dedicato invece di semplice desktop ridotto.
- Navigazione inferiore a cinque voci con tap target ampi e safe-area.
- Home a colonna singola: carosello prima dei KPI.
- Fixture e partite con griglia ricomposta.
- Tabelle scorrevoli orizzontalmente soltanto quando non esiste una rappresentazione equivalente più semplice.
- Setup amministrativo non inserito nella navigazione mobile primaria: verrà introdotto come percorso separato al completamento dei permessi.

## Animazioni

- Cambi slide nel carosello ogni 7,2 s quando pagina e browser sono attivi.
- Controlli manuali e indicatori di slide.
- Hover/press discreti nelle card, filtri, menu e pulsanti.
- `prefers-reduced-motion`: disabilita animazioni e rotazione automatica.

## Componenti riutilizzabili

`panel`, `badge`, `kpi`, `crest`, `matchSmall`, `fixtureCard`, `filter-button`, `modalFrame`, `empty-state`. I raggruppamenti UI seguono la funzione (partite, dati atleta, classifiche, autenticazione), non il tipo di tabella SQL.

## Modalità compact dashboard (ottobre 2026)

- Sistema dimensionale centralizzato in `src/layout-compact.css`, separato dal tema base (`src/styles.css`).
- Intestazioni su una sola riga con sezione, titolo, contesto e azioni: le informazioni non occupano più blocchi verticali vuoti.
- Pannelli a densità superiore, spaziatura 8–12px, angoli 9–14px, sidebar 208px, topbar 54px.
- Home: spotlight, performance, classifica, agenda e quadro rosa. Grafici dentro la card e nessun dato duplicato come grande card singola.
- Infografiche vettoriali SVG in `src/visuals.js`: andamento gol fatti/subiti, bilancio V/N/P, splits casa/trasferta, marcatori e ruoli. Nessuna libreria di grafici caricata.
- Con una sola partita valida, si usa un comparatore a barre anziché una curva a punto singolo. Con zero partite, stato vuoto esplicito: nessuna statistica inventata.
- Le tabelle conservano allineamento e leggibilità, con viewport a scroll solo dove è necessario (calendario completo desktop).
- Mobile: card in singola colonna, KPI su quattro colonne, navigazione persistente compatta; tap target e safe area invariati.
