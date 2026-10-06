function patchVotePickers(root=document){
 root.querySelectorAll?.('.vote-picker-clear').forEach(node=>node.remove());
 root.querySelectorAll?.('.vote-picker-option').forEach(button=>{
  const active=button.classList.contains('active');
  if(active){
   button.removeAttribute('data-vote-pick');
   button.setAttribute('data-vote-clear','');
   button.setAttribute('aria-label','Rimuovi il voto selezionato e imposta SV');
  }else{
   button.removeAttribute('data-vote-clear');
   button.setAttribute('data-vote-pick','');
  }
 });
 const intro=root.querySelector?.('.votes-intro p');
 if(intro&&intro.textContent.includes('×'))intro.textContent='Scorri orizzontalmente e scegli il voto · tocca il voto selezionato per tornare a SV.';
}

patchVotePickers();
new MutationObserver(mutations=>{
 for(const mutation of mutations){
  if(mutation.type==='childList'&&mutation.addedNodes.length){
   patchVotePickers();
   break;
  }
 }
}).observe(document.documentElement,{childList:true,subtree:true});
