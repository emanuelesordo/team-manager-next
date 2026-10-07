// Consegna soltanto dati JSON alla pagina. Nessun accesso a credenziali o localStorage.
chrome.runtime.onMessage.addListener((message, sender, reply) => {
 if(message?.type !== 'CSI_DELIVER')return;
 if(!location.hash.startsWith('#match/')){reply({ok:false,error:'Apri prima il match corretto su Team Manager.'});return}
 const payload=message.payload;
 if(!payload || typeof payload.code!=='string' || !/^C[0-9A-Z]+$/.test(payload.code) || !Array.isArray(payload.events)){reply({ok:false,error:'JSON CSI non valido'});return}
 document.dispatchEvent(new CustomEvent('tm:csi-extension-payload',{detail:JSON.stringify(payload)}));
 reply({ok:true});
});
