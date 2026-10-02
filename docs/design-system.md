# Design system — Team Manager Next

Stato: interfaccia realizzata, non documentazione di funzioni amministrative già operative.

## Direzione

Flat/minimal con soft glassmorphism, bordi sottili e trasparenze leggere.
Le quattro reference fornite orientano due esperienze distinte.

- DESKTOP — atmosfera di stadio serale, verde petrolio, pannelli traslucidi, sidebar laterale e accenti lime.
- MOBILE — verde campo e avorio, card chiare, risultati centrali, navigazione inferiore. Non è il desktop semplicemente rimpicciolito.
- COMPONENTI — geometria precisa, meno arrotondamenti superflui, contrasto nelle cifre, loghi reali caricati dal database.

## Token

| Token | Desktop | Mobile |
| --- | --- | --- |
| --ink | #edf6ee | #172b21 |
| --accent | #bef66a | #137c46 |
| --surface | #112520 | #fbfff5 |
| --glass | rgba(14,31,29,.72) | rgba(255,255,246,.88) |
| --radius | 21px | 21px |
| page background | #071a17 | #edf3e8 |

Font: DM Sans per il corpo, Manrope per titoli e indicatori; numeri tabulari.

## Desktop

Sidebar sticky 234px, area contenuti fluida fino a 1480px. Home: zona hero 1.62 / 0.78, cinque KPI di stagione, calendario e risultati accanto alla classifica. La sidebar contiene il selettore stagione e l'area personale. Tabelle in scroll orizzontale, mai falsare l'ordine dei dati con tagli dei nomi o dei punteggi.

## Mobile dedicato

Breakpoint 800px. Header verde sticky con accesso ad area personale e menu completo. Barra inferiore safe-area-aware con 5 tab: Home, Competizioni, Calendario, Rosa, Statistiche. Match Center, Setup e selezione stagione accessibili dal menu superiore.

Home: carosello primo piano; KPI in scorrimento orizzontale con snap; partite future, ultime partite, classifica e forma. La card laterale Ultimo risultato desktop non viene ripetuta perché il carosello include lo storico. Dialoghi come bottom sheet. Riservare spazio in fondo per la barra di navigazione.

## Movimento e stati

Animazioni leggere sui cambi slide, ingresso delle card, hover e feedback. Il carosello ruota ogni 7,2 secondi, è utilizzabile con frecce/pallini/sweep, si ferma in background e rispetta prefers-reduced-motion. Evitare parallasse continuo, effetti finti 3D e animazioni che ostacolano la lettura.

Dati mancanti non equivalgono a zero. L'etichetta LIVE compare solo per partite effettivamente in corso. Le view SQL restano la fonte delle statistiche personali. Ricerca rosa client-side senza chiamate a ogni lettera.

## File

- index.html: cornice applicativa, navigazione e modale.
- src/app.js: rendering e interazioni.
- src/styles.css: CSS base + layer EXPERIENCE 02.
- src/data.js: richieste al backend e sessioni.
- src/domain.js: dominio sportivo.
- docs/specification-original.txt: documento sorgente completo e non reinterpretato.
- docs/ui-layout.md: organizzazione delle schermate.

Nessun componente deve introdurre una seconda fonte di verità dei dati.
