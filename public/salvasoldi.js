/* SalvaSoldi: UI and validated requests to the server-side AI endpoint. */
(() => {
  const section = document.querySelector("#salvasoldi-section");
  if (!section) return;
  const ids = id => document.getElementById(id);
  const status = ids("salvasoldi-status");
  const results = ids("salvasoldi-results");
  const launch = ids("show-salvasoldi");
  const home = ids("welcome");
  const hideOtherSections = () => {
    ["results-section","favorites-section","personal-section","history-section","shopping-section","archimede-section","chef-section"].forEach(id => { const node=ids(id); if(node) node.hidden=true; });
    const tryRecipes=document.querySelector(".try-recipes-section"); if(tryRecipes) tryRecipes.hidden=true;
    const daily=ids("daily-recipe-section"); if(daily) daily.hidden=true;
    if(home) home.hidden=true;
    const hero=document.querySelector(".hero"); if(hero) hero.hidden=true;
  };
  const show = () => { hideOtherSections(); section.hidden=false; window.scrollTo({top:0,behavior:"smooth"}); };
  launch?.addEventListener("click",show);
  ids("salvasoldi-back")?.addEventListener("click",() => { section.hidden=true; if(home) home.hidden=false; const hero=document.querySelector(".hero"); if(hero) hero.hidden=false; const daily=ids("daily-recipe-section"); if(daily) daily.hidden=false; const tries=document.querySelector(".try-recipes-section"); if(tries) tries.hidden=false; });
  function setTab(which) {
    const budget=which==="budget";
    ids("budget-panel").hidden=!budget; ids("cost-panel").hidden=budget;
    ids("budget-tab").classList.toggle("is-active",budget); ids("cost-tab").classList.toggle("is-active",!budget);
    ids("budget-tab").setAttribute("aria-selected",String(budget)); ids("cost-tab").setAttribute("aria-selected",String(!budget));
    results.innerHTML=""; status.hidden=true;
  }
  ids("budget-tab").addEventListener("click",()=>setTab("budget"));
  ids("cost-tab").addEventListener("click",()=>setTab("cost"));
  const deviceKey="cosa-cucino-salvasoldi-device-v1";
  function deviceId(){
    let id=localStorage.getItem(deviceKey);
    if(!id){
      id=crypto.randomUUID?crypto.randomUUID():"salvasoldi-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      localStorage.setItem(deviceKey,id);
    }
    return id;
  }
  const deviceKey="cosa-cucino-salvasoldi-device-v1";
  function deviceId(){
    let id=localStorage.getItem(deviceKey);
    if(!id){
      id=crypto.randomUUID?crypto.randomUUID():"salvasoldi-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      localStorage.setItem(deviceKey,id);
    }
    return id;
  }
  const euro = value => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(Number(value)||0);
  const safe = value => String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function setStatus(message,error=false){status.textContent=message;status.hidden=false;status.classList.toggle("is-error",error);}
  function renderResult(data,mode) {
    if(!data || typeof data!=="object") throw new Error("Il server ha restituito una risposta non valida.");
    const dishes=Array.isArray(data.dishes)?data.dishes:[];
    const ingredients=Array.isArray(data.ingredients)?data.ingredients:[];
    const alternatives=Array.isArray(data.alternatives)?data.alternatives:[];
    const total=Number(data.total_cost??data.total??0), perPerson=Number(data.cost_per_person??data.per_person??0);
    let html='<article class="salvasoldi-result-card"><h3>'+safe(data.title||(mode==="budget"?"Il tuo menu":"Stima della spesa"))+'</h3>';
    if(data.summary) html+='<p>'+safe(data.summary)+'</p>';
    if(dishes.length) html+='<h4>Menu proposto</h4>'+dishes.map(d=>'<div><strong>'+safe(d.course||d.portata||"Piatto")+': '+safe(d.name||d.nome||"")+'</strong><p>'+safe(d.description||d.descrizione||"")+'</p></div>').join("");
    if(ingredients.length) html+='<h4>Lista degli ingredienti</h4><ul class="salvasoldi-ingredient-list">'+ingredients.map(i=>'<li><span>'+safe(i.name||i.ingredient||i.ingrediente||"Ingrediente")+' · '+safe([i.quantity,i.unit].filter(Boolean).join(" "))+'</span><strong>'+euro(i.price??i.cost)+'</strong></li>').join("")+'</ul>';
    html+='<div class="salvasoldi-cost-summary"><div><span>Totale stimato</span><strong>'+euro(total)+'</strong></div><div><span>Costo a persona</span><strong>'+euro(perPerson)+'</strong></div><div><span>Persone</span><strong>'+safe(data.people??data.persons??"—")+'</strong></div></div>';
    if(alternatives.length) html+='<div class="salvasoldi-alternatives"><h4>Idee per risparmiare</h4><ul>'+alternatives.map(a=>'<li>'+safe(typeof a==="string"?a:(a.description||a.suggestion||a.name||""))+'</li>').join("")+'</ul></div>';
    html+='</article>'; results.innerHTML=html;
  }
  async function request(payload,button,mode) {
    button.disabled=true; button.textContent="Sto elaborando...";
    results.innerHTML=""; setStatus("Sto preparando il calcolo. Potrebbe richiedere qualche secondo.");
    try {
      const response=await fetch("/api/salvasoldi",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload)});
      const type=response.headers.get("content-type")||"";
      if(!type.includes("application/json")) throw new Error("Il servizio SalvaSoldi non è ancora configurato sul server. È necessaria l'attivazione dell'endpoint AI /api/salvasoldi.");
      const data=await response.json();
      if(!response.ok) throw new Error(data.detail||data.error||"Non è stato possibile completare il calcolo.");
      renderResult(data,mode); status.hidden=true;
    } catch(error) {
      setStatus(error.message||"Errore durante la richiesta. Riprova più tardi.",true);
    } finally {
      button.disabled=false;
      button.textContent=mode==="budget"?"Crea il mio menu ↗":"Calcola la spesa ↗";
    }
  }
  ids("budget-form").addEventListener("submit",event=>{
    event.preventDefault();
    const budget=Number(ids("budget-per-person").value),people=Number(ids("budget-people").value);
    const courses=[...document.querySelectorAll('input[name="course"]:checked')].map(input=>input.value);
    if(!Number.isFinite(budget)||budget<=0||!Number.isInteger(people)||people<1||!courses.length){setStatus("Inserisci un budget valido, il numero di persone e almeno una portata.",true);return;}
    const button=event.currentTarget.querySelector('button[type="submit"]');
    request({device_id:deviceId(),mode:"create_menu",budget_per_person:budget,people,courses,diet:ids("budget-diet").value,notes:ids("budget-notes").value.trim(),currency:"EUR",locale:"it-IT"},button,"budget");
  });
  ids("cost-form").addEventListener("submit",event=>{
    event.preventDefault();
    const menu=ids("cost-menu").value.trim(),people=Number(ids("cost-people").value);
    if(menu.length<3||!Number.isInteger(people)||people<1){setStatus("Descrivi almeno un piatto e indica un numero di persone valido.",true);return;}
    const button=event.currentTarget.querySelector('button[type="submit"]');
    request({device_id:deviceId(),mode:"calculate_cost",menu,people,currency:"EUR",locale:"it-IT"},button,"cost");
  });
})();
