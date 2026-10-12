# Istruzioni di sviluppo — Team Manager Next

Per modifiche a pronostici, analisi prepartita, storico, potenziale o formazione ipotetica, consultare prima [docs/algorithms/00-architettura.md](docs/algorithms/00-architettura.md) e il documento specifico.

## Regole obbligatorie
1. Leggere i file sorgente **dal repository GitHub corrente**, non assumere che la chat descriva il comportamento implementato.
2. Identificare funzione, input Supabase, invarianti, dipendenze e test prima di modificare.
3. Distinguere comportamento ATTUALE, desiderato e DA VALIDARE. Non presentare ipotesi come algoritmo già attivo.
4. Modificare codice, documentazione e test nello stesso intervento quando cambia una regola.
5. Usare solo dati disponibili prima del calcio d'inizio per previsioni retrospettive; evitare leakage.
6. Non inventare voti, indisponibilità, eventi, minutaggi o percentuali di accuratezza.
7. Eseguire `npm run check` quando disponibile, controllare i workflow di pubblicazione e il deployment; dichiarare gli eventuali controlli non eseguiti.
8. Evitare refactoring non richiesti e proteggere compatibilità desktop/mobile.
9. Non includere segreti, credenziali o token nei documenti.

## Indice
- [Algoritmi prepartita](docs/algorithms/00-architettura.md)
- [Simulazione classifica](docs/projections.md)
- [Archivio risultato/eventi](docs/architecture-single-event-result.md)
