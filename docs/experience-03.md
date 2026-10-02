# Experience 03 — interfaccia e movimento

## Quattro riferimenti visivi

- Lime soft-glass: card trasparenti e indicatori live sobri.
- Dashboard icy blue: chiarezza di risultati, KPI e calendari.
- Dark stadium: atmosfera petrolio, hero immersiva e vetro leggero desktop.
- Mobile pitch-green e avorio: risultati centrali, card chiare e tab inferiori.

I mockup restano riferimenti visuali. Non usare mai squadre, marcatori, giocatori o risultati fittizi delle immagini.

## Due interfacce, un solo modello dati

Desktop da 801px: sidebar, dashboard con spotlight e ultimo match, cinque KPI, classifica e calendario a colonne. Stadio astratto SVG locale. Mobile fino a 800px: header verde sticky, spotlight ad alto contrasto, KPI swipe, card avorio, barra inferiore e menu completo in dialog a bottom sheet.

## Elementi dinamici

Carosello Hero con slide reali, frecce, swipe, indicatori, autoplay, rispetto della visibilità della pagina e preferenze reduced motion. Transizioni native View Transitions con fallback. Microinterazioni sulle card e feedback sugli stati, non sui dati.

## Organizzazione codice

- src/styles.css: base di layout, classi e compatibilità.
- src/experience.css: tema e responsive specializzati.
- src/app.js: presentazione e interazioni.
- src/data.js: fonte applicativa Supabase, caching e autenticazione.
- src/domain.js: logiche sportive indipendenti dalla UI.
- assets/pitch-atmosphere.svg: motivo astratto desktop.
- docs/specification-original.txt: allegato funzionale conservato integralmente.

## Limiti espliciti

I moduli di scrittura, live editing, import e gestione autorizzazioni non sono presentati come funzionanti finché non siano implementati con controllo dei vincoli Supabase e RLS. Fixture ufficiali e match operativi restano distinti; dati assenti rimangono assenti.