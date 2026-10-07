# csi-scraper

Estrae in JSON i dati di una gara dalla pagina "Info gara" di
[live.centrosportivoitaliano.it](https://live.centrosportivoitaliano.it).

## Installazione e avvio

Serve Python 3.10 o superiore. Tkinter serve solo per l'interfaccia grafica (`csi_gui.py`):
lo scraper da riga di comando funziona anche senza.

### macOS

```bash
brew install python python-tk@3.14     # python-tk deve corrispondere alla versione di Python
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python csi_gui.py                                   # interfaccia grafica
.venv/bin/python csi_match.py "<url>"                         # riga di comando
```

Con il Python di python.org (invece di Homebrew) Tkinter è già incluso e `python-tk` non serve.

### Linux

```bash
# Debian / Ubuntu
sudo apt install python3 python3-venv python3-tk
# Fedora
sudo dnf install python3 python3-tkinter

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python csi_gui.py                                   # interfaccia grafica
.venv/bin/python csi_match.py "<url>"                         # riga di comando
```

Senza un gestore degli appunti attivo, il JSON copiato con **Copia** si perde alla chiusura della finestra.

### Windows

Installare Python da [python.org](https://www.python.org/downloads/) lasciando attiva l'opzione
"tcl/tk and IDLE" (inclusa di default). Poi, da PowerShell o dal Prompt dei comandi:

```powershell
py -m venv .venv
.venv\Scripts\pip install -r requirements.txt

.venv\Scripts\python csi_gui.py                               # interfaccia grafica
.venv\Scripts\python csi_match.py "<url>"                     # riga di comando
```

## Uso da riga di comando

Gli esempi usano `.venv/bin/python`; su Windows sostituirlo con `.venv\Scripts\python`.

```bash
.venv/bin/python csi_match.py "https://live.centrosportivoitaliano.it/26/Calcio-a-11/Veneto/Padova/PC11BD12/?j=..."
.venv/bin/python csi_match.py "<url>" --compact   # JSON su una riga
.venv/bin/python csi_match.py --file pagina.html  # da file HTML salvato
```

Exit code: `0` ok, `2` errore HTTP, `3` pagina non riconosciuta.

## Interfaccia grafica

Si incolla l'URL della pagina "Info gara" e si preme **Estrai** (o Invio). La finestra mostra due schede:
**Riepilogo** (risultato, campionato, campo ed eventi in ordine cronologico) e **JSON** (lo stesso output
del comando da riga di comando). **Copia** mette il JSON negli appunti, **Salva…** lo scrive in un file `.json`.

## Output

Il formato è descritto da [`match.schema.json`](match.schema.json) (JSON Schema draft 2020-12),
utilizzabile per validare l'output o generare tipi (es. `quicktype`, `datamodel-code-generator`).

- `code`, `date` (ISO), `time`, `competition` (`committee`, `sport`, `name`), `venue`
- `status`: testo del badge sopra il risultato (es. "Risultato ufficioso"), `null` se assente
- `home` / `away`: `name`, `url`, `logo`, `score` (`null` se la gara non è stata giocata)
- `periods`: un elemento per tempo, con etichetta e minuti di recupero
- `events`: in ordine cronologico, ognuno con `period`, `minute`, `team` (`home`/`away`) e `type`:
  - `goal` → `score` parziale (il marcatore non è pubblicato dal sito)
  - `yellow_card`, `blue_card` (cartellino azzurro CSI), `red_card` → `player`
  - `substitution` → `player_out`, `player_in`
  - `unknown` → `player`, `icon`, `text` grezzi

`minute` è il minuto di gara assumendo tempi da 40' (`HALF_LENGTH` in `csi_match.py`):
il sito fa ripartire i minuti a ogni tempo, quindi al 2° tempo vengono sommati 40'.
I minuti oltre la durata del tempo sono recupero: `minute` resta fermo a fine tempo e
`stoppage_minute` indica i minuti in più (es. 41' del 1° tempo → `minute: 40, stoppage_minute: 1`,
cioè 40+1). Senza recupero `stoppage_minute` è `null`.

## Test

```bash
.venv/bin/pip install -r requirements-dev.txt && .venv/bin/pytest
```

Su Windows: `.venv\Scripts\pip install -r requirements-dev.txt` e poi `.venv\Scripts\pytest`.
I test dell'interfaccia grafica vengono saltati se Tkinter non è installato.
