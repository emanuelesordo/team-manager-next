# CSI Live Scraper · Chrome (Manifest V3)

## Installazione
1. Chrome → `chrome://extensions` → abilita **Modalità sviluppatore**.
2. **Carica estensione non pacchettizzata** → scegli `tools/csi-chrome-extension` dalla checkout locale della repository.
3. Apri CSI Live su una **scheda gara completa di parametro ?j=**.
4. Premi **Estrai pagina**, poi **Esporta JSON**.
5. Per inviare direttamente: apri Team Manager Next in un'altra scheda, entra nella partita CSI corrispondente → **Verifica / rettifica**. Premi **Invia alla partita aperta su Team Manager**. In Team Manager verifica il codice gara e premi **Importa e confronta**.

## Calendario
**Estrai calendario** rileva tutti i collegamenti CSI presenti nella pagina e li visita in sequenza (pausa di 800 ms tra richieste). Esporta un archivio JSON di risultati per partite. I record non riconosciuti sono segnalati e mai convertiti in eventi artificiali. Non aggira restrizioni di accesso o captcha.

## Sicurezza
L'estensione non accede ai token o alle password. L'invio passa solo dalla scheda Team Manager; è l'app a eseguire la validazione server-side del codice partita e dei nomi delle squadre. L'estensione non approva eventi e non modifica direttamente risultati.

## Limitazioni
L'estrazione del dettaglio dipende dall'HTML CSI effettivamente pubblicato. La prima versione preferisce bloccare un'esportazione incompleta e segnalarlo anziché creare eventi o punteggi inventati. Testare su un campione reale di schede partita concluse e in programma.
