# Design System · Team Manager Next
Ispirazione: schermata mobile chiara giallo/salvia, dashboard desktop celeste soft glass, matchday desktop immersivo petrolio/notte. La palette deve essere coerente con la leggibilità, non una sovrapposizione indiscriminata.

## Token desktop notte
- Sfondo `#071e27`, superficie translucida `#12313abf`, bordo `#d5f5ea2b`.
- Testo `#effbf7`, secondario `#acc6c6`, accento `#bafa96`.
- Raggio 22px, pillole soltanto per stato/chip, blur pannello 20px.
- Emersione delle card a hover al massimo 2–3px; nessun movimento decorativo costante.
- Contesto stadio in hero con asset locale `assets/pitch-atmosphere.svg`.

## Variante desktop ghiaccio
Tema opzionale persistito soltanto lato browser: blu ghiaccio, pannelli avorio/bianco, azzurro saturo come accento. Il pulsante nella topbar cambia il tema; nessun dato backend è interessato.

## Mobile dedicato
- Fondo verde/salvia/limone, card bianco latte semitrasparente.
- Hero risultato sfumato con crest, informazioni vere, carosello a 6,8 secondi.
- KPI a swipe e tab bar inferiore con safe-area inset.
- Bottom sheet per login e selezione stagione; azioni da tastiera complete.
- Controllo `prefers-reduced-motion`, testi ad alto contrasto, nessun valore sportivo campione.

## Gerarchia delle superfici · regola globale (04/10/2026)
- Una sola superficie glass per blocco principale: hero, grande pannello, sidebar o sezione autonoma. Non applicare una nuova card a ogni sottogruppo, giocatore, riga, risultato, metrica o elemento del campo.
- Le sottosezioni di un pannello devono essere **piatte**: fondo trasparente, senza ombra, contorno o raggio; usare spaziatura contenuta e, se necessario, un separatore sottile tra righe.
- Campo da calcio, maglie, stemmi, controlli, stati di attenzione e finestre modali conservano la loro semantica visiva. Evidenziare focus, selezione e indisponibilità senza costruire nuove card.
- Questa regola è centralizzata in `fresh/flat-surfaces.css`, caricato **dopo** tutti gli altri fogli nel documento effettivamente servito (`index.html`); si applica sia su desktop sia su mobile e a tutti i temi.
