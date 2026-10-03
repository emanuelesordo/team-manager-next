/** Parse official match venue text without guessing a team from its name.
 * Fixture-specific venue always takes priority (a club can use a different field). */
export function parseFixtureVenue(raw){
 const input=String(raw||'').trim();
 if(!input)return null;
 const cleaned=input.replace(/\s*\([^()]*\)\s*$/,'').trim();
 const pieces=cleaned.split(/\s+-\s+(?=\d{5}\s)/);
 if(pieces.length!==2)return {name:cleaned,street:null,city:null,province:null};
 const front=pieces[0].trim(),end=pieces[1].trim();
 const m=/(?:^|\s)(via|viale|strada|piazza|piazzale|vicolo|corso|contrada|largo|località|localita)\b/i.exec(front);
 const suffix=/^\d{5}\s+(.+?)\s+([a-z]{2})$/i.exec(end);
 if(!m||!suffix)return {name:cleaned,street:null,city:null,province:null};
 const streetIndex=m.index+(m[0].length-m[1].length);
 const street=front.slice(streetIndex).replace(/[,\s]+$/,'').trim();
 const name=front.slice(0,streetIndex).trim();
 return name&&street?{name,street,city:suffix[1].trim(),province:suffix[2].toUpperCase()}:
  {name:cleaned,street:null,city:null,province:null};
}
export function formatClubAddress(club){
 if(!club)return '';
 const street=club.home_venue_street||'';
 const city=club.home_venue_city||'';
 const province=club.home_venue_province||'';
 return [street,city+(province?' ('+province.toUpperCase()+')':'')].filter(Boolean).join(', ')||club.home_venue_address||'';
}
export function fixtureVenueDetails(fixture={},homeClub=null){
 const parsed=parseFixtureVenue(fixture.venue);
 // Imports can mistakenly put the entire CSI stadium string in venue_name.
 // Always normalize that field before displaying it; otherwise use the
 // explicit per-match venue, then the club's registered stadium.
 const named=parseFixtureVenue(fixture.venue_name);
 const name=named?.name||parsed?.name||homeClub?.home_venue_name||'';
 const location=fixture.venue_address||(
  parsed?.street?[parsed.street,parsed.city+(parsed.province?' ('+parsed.province+')':'')].filter(Boolean).join(', '):''
 )||formatClubAddress(homeClub);
 return {name,address:location};
}
