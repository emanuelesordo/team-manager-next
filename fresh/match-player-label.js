/** Compact player label for all Match Center presentation surfaces. */
export function matchPlayerLabel(person){
 if(!person)return 'Giocatore non censito';
 const first=String(person.first_name||'').trim();
 const last=String(person.last_name||'').trim();
 if(first&&last)return first[0].toLocaleUpperCase('it-IT')+'. '+last;
 return last||first||'Giocatore non censito';
}
