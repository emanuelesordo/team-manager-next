# Team Manager Next

Webapp calcistica con frontend interamente nuovo, adattato a desktop e smartphone e con Supabase come unica fonte dei dati. Il README ufficiale resta intenzionalmente sintetico: le decisioni si accumulano in file specializzati dentro `docs/`.

## Avvio
`npm run dev` → apri `http://localhost:8080`. Nessun bundler richiesto. `npm run check` verifica la sintassi dei moduli, i test di dominio e la build. Il workflow GitHub Pages pubblica automaticamente `dist/`.

## Architettura attiva
- `index.html`: unico entrypoint.
- `fresh/main.js`: app, navigazione, carousel, schede desktop/mobile.
- `fresh/style.css`: interfaccia desktop stile stadium glass e mobile in avorio/salvia.
- `fresh/api.js`: gateway Supabase e autenticazione esistente.
- `fresh/domain.js`: calcoli deterministici e riconciliazione prudente delle partite.
- `fresh/config.js`: soltanto URL e chiave *publishable*.
- `docs/`: specifica e documentazione progressiva.

I vecchi esperimenti `src/` e `ui/` restano nel repository come materiale non caricato, escluso dalla build; saranno rimossi dopo la verifica della nuova versione.

Stato: consultazione Home, Competizioni, Calendario, Match Center, Rosa, scheda giocatore e Statistiche; login username/password e sessione. Operazioni amministrative, import e gestione live con scritture richiedono una fase dedicata di audit e integrazione RLS/DB, non sono simulate come già disponibili.

[Specifica funzionale integrale](docs/specification-original.txt) · [Design](docs/design-system.md) · [Layout](docs/ui-layout.md) · [Funzioni](docs/modules.md) · [Stato di sviluppo](docs/roadmap.md).
