# Interfaccia 04 — glass sportivo

Riferimenti: dashboard desktop petrolio con scoreboard immersivo e variante ghiaccio; mobile salvia/limone a pannelli traslucidi con barra inferiore fissa. Navigazione per tema: Home, Tornei, Calendario, Rosa, Numeri, Club e Profilo. Nessuna schermata duplicata tra desktop e mobile: dati condivisi, composizione responsive differenziata.

Interazioni: carosello Home temporizzato, indicatori e pulsanti precedenti/successivi, swipe touch, stati live, filtri, grafici graduatoria e ricerca rosa in locale. Dettaglio partita con informazioni, schieramento, eventi e voti quando disponibili. Login tramite Edge Function esistente. L'admin può aggiornare il risultato della fixture ufficiale; resta distinta dagli eventi operativi, senza fabbricare marcatori. La sicurezza di scrittura dipende dalla RLS.

Dati: la vista pubblica tm_public_teams fornisce solo branding delle squadre discoverable. Le sezioni sportive attingono alle tabelle app_ della stagione selezionata; nessun record storico viene eliminato o duplicato.

Prossime fasi: gestione completa convocazioni, operazioni live, editor competizioni, import calendariale validato, audit statistiche e flussi amministrativi avanzati.
