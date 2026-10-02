# Frontend ex novo — ottobre 2026
## Fonti
Quattro screenshot di riferimento allegati dall'utente e specifica funzionale in `docs/specification-original.txt`. Ispezionati **soltanto** il repository `team-manager-next` e il Supabase `team-manager`, non i repository o le conversazioni precedenti.

## Separazione visiva
**Desktop (>760px).** Sidebar compatta, topbar, atmosfera da stadio notturno, hero principale, pannelli petrolio sfumati in vetro, verde lime per gli stati attivi; possibilità di variante light blu ghiaccio. La priorità è leggere incontro, classifica, forma e scadenze.

**Mobile (≤760px).** Composizione dedicata su sfondo giallo tenue, salvia e azzurro, header da 70px, card risultato translucida, KPI orizzontali con snap, navigazione dock inferiore in 5 sezioni, menu e login come bottom sheet. Non usa la stessa struttura ad incastro delle colonne desktop.

## Dati e sicurezza
Ogni valore viene richiesto a Supabase usando soltanto chiavi pubblicabili. La stagione è filtrata alla fonte, non via duplicazione in locale. Login mediante la Edge Function `auth-login` esistente. RLS governa l'accesso; le scritture saranno implementate soltanto dopo verifica di autorizzazioni, transazioni e sincronizzazione fixture/match. Le fixture ufficiali danno calendario e score; i dati operativi sono associati solo se nome avversario, competizione, casa/trasferta e orario producono una corrispondenza univoca.
