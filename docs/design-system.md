# Design system e interfacce

## Direzione visiva

L'immagine `assets/reference-design.png` costituisce il riferimento iniziale di **composizione**: card morbide e sovrapposte, informazioni sportive a rilievo lieve, superfici traslucide, navigazione mobile dedicata e schede match enfatizzate. La palette è intenzionalmente modificata rispetto all'immagine: le tonalità verdine vengono reinterpretate come nero grafite e le zone chiare diventano bianco tenue / giallo acido controllato.

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

- Sidebar persistente da 242px.
- Barra superiore contestuale (sezione, stato sync, refresh).
- Home con hero carosello dell'ultimo match e prossimo,.
- Competizioni con classifica e calendario affiancati quando c'è spazio.
- Match Center in dialog consultivo unificato, con tre tab.

## Mobile (prima classe)

- Breakpoint principale 800px, design dedicato invece di semplice desktop ridotto.
- Navigazione inferiore a cinque voci con tap target ampi e safe-area.
- Home: carosello prima di KPI principali.
- Fixture e partite con griglia ricomposta.
- Tabelle scorrevoli orizzontalmente soltanto quando non esiste una rappresentazione equivalente più semplice.
- Setup amministrativo non inserito nella navigazione mobile primaria: verrà introdotto come percorso separato al completamento dei permessi.

## Animazioni

- Cambi slide nel carosello ogni 7,2 s quando pagina e browser sono attivi.
- Controlli manuali e indicatori di slide.
- Hover/press discreti nelle card, filtri, menu e pulsanti.
- `prefers-reduced-motion`: disabilita animazioni e rotazione automatica.

## Altre regole comuni

- ogni sezione ha una hero che si distingue rispetto agli altri contenuti della pagina, per forma e colori.

## Componenti riutilizzabili

`panel`, `badge`, `kpi`, `crest`, `matchSmall`, `fixtureCard`, `filter-button`, `modalFrame`, `empty-state`. I raggruppamenti UI seguono la funzione (partite, dati atleta, classifiche, autenticazione), non il tipo di tabella SQL.
