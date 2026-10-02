# Frontend ex-novo — 02/10/2026

Questa versione non deriva dal frontend precedente.

## Input utilizzati
- indicazioni della chat corrente;
- quattro reference grafiche allegate nella chat;
- schema e dati Supabase già esistenti, usati esclusivamente come sorgente dati;
- repository `team-manager-next` esclusivamente come destinazione di pubblicazione.

## Direzione
Desktop: esperienza “match center” immersiva, senza sidebar; top navigation orizzontale, hero da stadio, grande spotlight della prossima partita, metriche e pannelli sottostanti.

Mobile: composizione autonoma, non semplice riduzione del desktop. Header compatto, hero verde, scorecard, KPI orizzontali a swipe, contenuti chiari avorio e bottom navigation.

## Moduli presenti
Home, Calendario, Competizione, Rosa, Statistiche.

## Regole
Nessun dato sportivo dei mockup viene copiato. Risultati, squadra, stagione, classifica e rosa arrivano da Supabase. Il frontend non modifica lo schema DB.