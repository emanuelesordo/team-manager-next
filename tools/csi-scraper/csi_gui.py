#!/usr/bin/env python3
"""Interfaccia grafica (Tkinter) per lo scraper di csi_match.py.

Uso:
    python csi_gui.py
"""

from __future__ import annotations

import json
import queue
import threading
import tkinter as tk
from datetime import date
from tkinter import filedialog, font, messagebox, ttk

import requests

import csi_match
from csi_match import ParseError

EVENT_LABELS = {
    "goal": "Gol",
    "yellow_card": "Ammonizione",
    "blue_card": "Cartellino azzurro",
    "red_card": "Espulsione",
    "substitution": "Sostituzione",
    "unknown": "Evento",
}


def scrape(url: str) -> dict:
    url = url.strip()
    if not url:
        raise ValueError("Inserisci l'URL della gara")
    return csi_match.parse_match(csi_match.fetch(url), url)


def to_json(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def _player(p: dict | None) -> str:
    if not p:
        return "?"
    name = p.get("name") or "?"
    return f"{name} ({p['number']})" if p.get("number") is not None else name


def _minute(event: dict) -> str:
    if event.get("minute") is None:
        return "?"
    if event.get("stoppage_minute"):
        return f"{event['minute']}+{event['stoppage_minute']}'"
    return f"{event['minute']}'"


def _event_detail(event: dict) -> str:
    kind = event.get("type")
    if kind == "goal":
        score = event.get("score")
        return f"{score['home']}-{score['away']}" if score else ""
    if kind == "substitution":
        return f"{_player(event.get('player_out'))} → {_player(event.get('player_in'))}"
    if kind == "unknown":
        return event.get("text") or ""
    return _player(event.get("player"))


def format_summary(data: dict) -> str:
    """Riepilogo testuale leggibile dell'output di parse_match."""
    home, away = data.get("home") or {}, data.get("away") or {}
    teams = {"home": home.get("name") or "Casa", "away": away.get("name") or "Ospite"}

    if home.get("score") is not None and away.get("score") is not None:
        headline = f"{teams['home']} {home['score']} - {away['score']} {teams['away']}"
    else:
        headline = f"{teams['home']} - {teams['away']}"
    if data.get("status"):
        headline += f"   ({data['status']})"
    lines = [headline]

    comp = data.get("competition") or {}
    comp_parts = [comp.get(k) for k in ("name", "sport", "committee") if comp.get(k)]
    if comp_parts:
        lines.append(" · ".join(comp_parts))

    when = []
    if data.get("date"):
        when.append(date.fromisoformat(data["date"]).strftime("%d/%m/%Y"))
    if data.get("time"):
        when.append(f"ore {data['time']}")
    info = [" ".join(when)] if when else []
    if data.get("code"):
        info.append(f"Codice {data['code']}")
    if info:
        lines.append(" · ".join(info))

    venue = data.get("venue") or {}
    if venue.get("name"):
        lines.append(f"Campo: {venue['name']}")

    events = data.get("events") or []
    lines.append("")
    if not events:
        lines.append("Nessun evento")
        return "\n".join(lines)

    periods = {p["period"]: p for p in data.get("periods") or []}
    team_width = max(len(name) for name in teams.values())
    label_width = max(len(label) for label in EVENT_LABELS.values())
    current = None
    for event in events:
        if event.get("period") != current:
            current = event.get("period")
            header = f"{current}° tempo"
            stoppage = periods.get(current, {}).get("stoppage_minutes")
            if stoppage:
                header += f" (recupero {stoppage}')"
            lines.append(header)
        team = teams.get(event.get("team"), "")
        label = EVENT_LABELS.get(event.get("type"), event.get("type") or "")
        lines.append(
            f"  {_minute(event):<7} {team:<{team_width}}  {label:<{label_width}}  "
            f"{_event_detail(event)}".rstrip()
        )
    return "\n".join(lines)


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("CSI Live – Info gara")
        self.geometry("900x600")
        self.minsize(600, 400)

        self._queue: queue.Queue = queue.Queue()
        self._data: dict | None = None

        top = ttk.Frame(self, padding=8)
        top.pack(fill="x")
        ttk.Label(top, text="URL gara:").pack(side="left")
        self.url_var = tk.StringVar()
        entry = ttk.Entry(top, textvariable=self.url_var)
        entry.pack(side="left", fill="x", expand=True, padx=6)
        entry.bind("<Return>", lambda _e: self.start())
        entry.focus_set()
        self.go_btn = ttk.Button(top, text="Estrai", command=self.start)
        self.go_btn.pack(side="left")

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=8)
        self.summary_text = self._text_tab(notebook, "Riepilogo")
        self.json_text = self._text_tab(notebook, "JSON")

        bottom = ttk.Frame(self, padding=8)
        bottom.pack(fill="x")
        self.copy_btn = ttk.Button(bottom, text="Copia", command=self.copy, state="disabled")
        self.copy_btn.pack(side="left")
        self.save_btn = ttk.Button(bottom, text="Salva…", command=self.save, state="disabled")
        self.save_btn.pack(side="left", padx=6)
        self.status_var = tk.StringVar(value="Incolla l'URL della pagina 'Info gara' e premi Estrai")
        ttk.Label(bottom, textvariable=self.status_var).pack(side="left", padx=6)

    def _text_tab(self, notebook: ttk.Notebook, title: str) -> tk.Text:
        frame = ttk.Frame(notebook)
        notebook.add(frame, text=title)
        text = tk.Text(frame, wrap="none", state="disabled", font=font.nametofont("TkFixedFont"))
        yscroll = ttk.Scrollbar(frame, orient="vertical", command=text.yview)
        xscroll = ttk.Scrollbar(frame, orient="horizontal", command=text.xview)
        text.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        text.grid(row=0, column=0, sticky="nsew")
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")
        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)
        return text

    @staticmethod
    def _set_text(widget: tk.Text, content: str) -> None:
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", content)
        widget.configure(state="disabled")

    def start(self) -> None:
        if str(self.go_btn["state"]) == "disabled":
            return
        self.go_btn.configure(state="disabled")
        self.status_var.set("Download in corso…")
        url = self.url_var.get()
        threading.Thread(target=self._worker, args=(url,), daemon=True).start()
        self.after(100, self._poll)

    def _worker(self, url: str) -> None:
        # Gira fuori dal thread di Tk: comunica solo tramite la coda.
        try:
            self._queue.put(("ok", scrape(url)))
        except Exception as exc:  # noqa: BLE001 - gestito in _poll
            self._queue.put(("error", exc))

    def _poll(self) -> None:
        try:
            kind, payload = self._queue.get_nowait()
        except queue.Empty:
            self.after(100, self._poll)
            return
        self.go_btn.configure(state="normal")
        if kind == "ok":
            self._show(payload)
        else:
            self._error(payload)

    def _show(self, data: dict) -> None:
        self._data = data
        self._set_text(self.summary_text, format_summary(data))
        self._set_text(self.json_text, to_json(data))
        self.copy_btn.configure(state="normal")
        self.save_btn.configure(state="normal")
        self.status_var.set("Fatto")

    def _error(self, exc: Exception) -> None:
        if isinstance(exc, requests.RequestException):
            msg = f"Errore HTTP: {exc}"
        elif isinstance(exc, ParseError):
            msg = f"Errore di parsing: {exc}"
        elif isinstance(exc, ValueError):
            msg = str(exc)
        else:
            msg = f"Errore imprevisto: {exc}"
        self.status_var.set(msg)
        messagebox.showerror("Errore", msg, parent=self)

    def copy(self) -> None:
        if self._data is None:
            return
        self.clipboard_clear()
        self.clipboard_append(to_json(self._data))
        self.status_var.set("JSON copiato negli appunti")

    def save(self) -> None:
        if self._data is None:
            return
        path = filedialog.asksaveasfilename(
            parent=self,
            defaultextension=".json",
            initialfile=f"{self._data.get('code') or 'gara'}.json",
            filetypes=[("JSON", "*.json"), ("Tutti i file", "*")],
        )
        if not path:
            return
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(to_json(self._data) + "\n")
        self.status_var.set(f"Salvato in {path}")


if __name__ == "__main__":
    app = App()

    # Mentre Tk attende eventi l'interprete Python è fermo e non gestisce
    # SIGINT: un tick periodico fa arrivare subito il Ctrl+C.
    def _wake() -> None:
        app.after(200, _wake)

    _wake()
    try:
        app.mainloop()
    except KeyboardInterrupt:
        # Ctrl+C dal terminale: chiude la finestra senza stampare il traceback.
        app.destroy()
