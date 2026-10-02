# Team Manager Next

Interfaccia ricostruita da zero sulla base delle quattro reference e della specifica fornita. Nessun componente CSS/HTML/JS precedente viene caricato.

- `fresh/app.css`: layout desktop e mobile originali.
- `fresh/app.js`: nuove viste.
- `fresh/data.js`: lettura dati Supabase.
- `src/config.js`: infrastruttura già autorizzata per il solo collegamento Supabase.
- `fresh/stadium.svg`: asset originale.
- `docs/specification-original.txt`: specifica originale.

Funzioni: Home, Competizioni, Calendario, Rosa, Statistiche e dettagli consultivi. Gestione live e modifica dati da implementare. Nessun dato di database è stato alterato.

`npm run check` valida la build, GitHub Actions pubblica `dist/`.