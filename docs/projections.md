# Classifica proiettata — contratto calcolo

**Fonte**: `app_competition_fixtures`, `app_competition_standings`, `app_competitions`. Nessun dato viene persistito. Sono considerate concluse soltanto gare con `status='finished'` e due punteggi interi validi; sono simulate soltanto partite non concluse programmate/rinviate, mai annullate, e non si inventano marcatori.

**Punti**: vittoria `win_points`, pareggio `draw_points`, sconfitta `loss_points` della competizione. La vista SQL è stata aggiornata per gli stessi pesi.

**Forza relativa**: score in intervallo 0–1 per 30% rendimento stagionale (punti per gara normalizzati), 25% forma delle ultime cinque gare pesate verso le più recenti, 20% differenza reti/gara, 10% gol fatti/gara, 10% capacità difensiva misurata su gol subiti/gara, 5% rendimento in casa/trasferta. I valori sono limitati a intervalli fisiologici e ridimensionati verso il neutro (0,5) quando le partite disputate sono poche.

**Simulazione**: 10.000 stagioni, generatore XORSHIFT32 con seed FNV1a derivato da configurazione, calendario e risultati. Gol simulati con distribuzioni di Poisson e home advantage moderato. Per ogni esecuzione si sommano i punti finali. A pari punti le squadre condividono la stessa posizione indicativa (numero squadre con più punti + 1); non vengono applicati arbitrariamente gli spareggi non configurati.

**Output**: posizione media, punti finali medi, P20–P80 della posizione, posizione corrente a punti e quota % partite disputate. Quest'ultima **non è una probabilità di accuratezza**. La proiezione è una stima con limiti, non un dato ufficiale o predizione certa.

**Cache**: keyed alla firma JSON canonicalizzata del calendario/risultati/regole/stato della competizione; invalidata alla modifica di input. Calcolo differito dopo il primo rendering dell'area Competizioni. Motore e serializzazione testabili in `tests/projection.test.mjs`.
