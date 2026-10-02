const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function matchRoute(fixtureId){if(!UUID.test(String(fixtureId)))throw Error('ID fixture non valido');return '#match/'+fixtureId}
export function parseMatchRoute(hash){const m=/^#match\/([0-9a-f-]+)$/i.exec(String(hash||''));return m&&UUID.test(m[1])?m[1]:null}
