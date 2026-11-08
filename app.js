/* Épreuves — configuration Supabase
   Pour activer le partage entre tous les visiteurs, renseigne l'URL et la clé anon
   de ton projet Supabase ci-dessous. Ne mets JAMAIS une clé service_role ici. */
const SUPABASE_URL = "https://cigtsvzyeaxluneexnsa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AUky4UeugSkRErIjG_yMRw_vetPlrwY";
const BUCKET = "exam-pdfs";
const TURNSTILE_SITE_KEY = "0x4AAAAAAF4asAUByI_YNa1e";
let turnstileToken = "";
let turnstileWidgetId = null;
let formOpenedAt = 0;

const campuses = ["Lomé","Atakpamé","Kara","Sokodé","Dapaong","Tsévié","Kpalimé"];
const campusIcons = ["⌂","⌁","◇","▦","✳","⌖","⌂"];
const $ = (id) => document.getElementById(id);
const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const db = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let exams = [];
let selectedCampus = "";
let localDbPromise;

function openLocalDB(){
  if(localDbPromise) return localDbPromise;
  localDbPromise = new Promise((resolve,reject)=>{
    const request=indexedDB.open("epreuves-local",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("pdfs");
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return localDbPromise;
}
async function storeLocalPdf(id,file){
  const database=await openLocalDB();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction("pdfs","readwrite");
    tx.objectStore("pdfs").put(file,id);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function getLocalPdf(id){
  const database=await openLocalDB();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction("pdfs","readonly");
    const request=tx.objectStore("pdfs").get(id);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
function getLocalExams(){try{return JSON.parse(localStorage.getItem("epreuves-local-list")||"[]")}catch{return[]}}
function saveLocalExams(){localStorage.setItem("epreuves-local-list",JSON.stringify(exams))}
function makeId(){return "local-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)}
function safeText(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function showToast(message){const toast=$("toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),3400)}
function openModal(){ formOpenedAt=Date.now();turnstileToken="";if(window.turnstile&&turnstileWidgetId!==null)window.turnstile.reset(turnstileWidgetId);$("add-modal").classList.add("open");$("add-modal").setAttribute("aria-hidden","false");document.body.style.overflow="hidden"; }
function closeModal(){ $("add-modal").classList.remove("open");$("add-modal").setAttribute("aria-hidden","true");document.body.style.overflow="";$("form-feedback").textContent=""; }
function fillCampusSelects(){
  for(const id of ["filter-campus","form-campus"]){
    const select=$(id);
    campuses.forEach(name=>{const option=document.createElement("option");option.value=name;option.textContent=name;select.append(option)});
  }
}
function renderCampuses(){
  const grid=$("campus-grid");grid.innerHTML="";
  campuses.forEach((name,index)=>{
    const button=document.createElement("button");button.type="button";button.className="campus-card"+(selectedCampus===name?" active":"");
    button.innerHTML='<span class="campus-number">ÉTABLISSEMENT 0'+(index+1)+'</span><span class="campus-icon">'+campusIcons[index]+'</span><strong>'+safeText(name)+'</strong><small>Lycée Scientifique</small><span class="campus-arrow">↗</span>';
    button.addEventListener("click",()=>{selectedCampus=selectedCampus===name?"":name;$("filter-campus").value=selectedCampus;renderCampuses();renderExams();$("explorer").scrollIntoView({behavior:"smooth"})});
    grid.append(button);
  });
}
function termLabel(term){return ({"1":"1er trimestre","2":"2e trimestre","3":"3e trimestre"})[String(term)]||"Trimestre non précisé"}
function numberLabel(number,type){
  if(String(number)==="other")return "Autre évaluation";
  if(String(number)==="5")return "5e composition";
  return ({"1":"1er devoir","2":"2e devoir","3":"3e devoir"})[String(number)]||(type||"Évaluation");
}
function updateYearFilter(){
  const select=$("filter-year"),current=select.value;
  const years=[...new Set(exams.map(item=>item.school_year).filter(Boolean))].sort().reverse();
  select.innerHTML='<option value="">Toutes les années</option>'+years.map(year=>'<option value="'+safeText(year)+'">'+safeText(year)+'</option>').join("");
  select.value=years.includes(current)?current:"";
}
function renderExams(){
  const query=$("search-input").value.trim().toLocaleLowerCase("fr");
  const campus=$("filter-campus").value;
  const className=$("filter-class").value;
  const term=$("filter-term").value;
  const year=$("filter-year").value;
  const filtered=exams.filter(item=>{
    const text=[item.campus,item.class_name,item.series,item.subject,item.exam_type,item.school_year,item.notes].join(" ").toLocaleLowerCase("fr");
    return (!query||text.includes(query))&&(!campus||item.campus===campus)&&(!className||item.class_name===className)&&(!term||String(item.term)===term)&&(!year||item.school_year===year);
  }).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  $("results-count").textContent=filtered.length+" épreuve"+(filtered.length>1?"s":"")+" trouvée"+(filtered.length>1?"s":"");
  const list=$("exam-list");list.innerHTML="";
  filtered.forEach(item=>{
    const card=document.createElement("article");card.className="exam-card";
    const series=item.series?" · Série "+item.series:"";
    card.innerHTML='<div class="pdf-icon">PDF</div><div class="exam-info"><strong>'+safeText(item.subject)+' — '+safeText(item.exam_type||"Épreuve")+'</strong><p>'+safeText(item.campus)+' · '+safeText(item.class_name||"Secondaire")+safeText(series)+' · '+safeText(item.school_year)+'</p><div class="exam-tags"><span class="tag">'+safeText(termLabel(item.term))+'</span><span class="tag">'+safeText(numberLabel(item.number,item.exam_type))+'</span><span class="tag">'+(item.status==="approved"?"Publié":"Ajout local")+'</span></div></div><span class="exam-date">'+(item.created_at?new Date(item.created_at).toLocaleDateString("fr-FR"):"")+'</span><button class="download-button" type="button">Consulter ↗</button>';
    card.querySelector("button").addEventListener("click",()=>openExam(item));
    list.append(card);
  });
  $("empty-state").classList.toggle("show",filtered.length===0);
}
async function openExam(item){
  try{
    let url;
    if(item.local_file_id){const blob=await getLocalPdf(item.local_file_id);if(!blob)throw new Error("PDF introuvable sur cet appareil.");url=URL.createObjectURL(blob);}
    else if(db&&item.file_path){const {data,error}=db.storage.from(BUCKET).getPublicUrl(item.file_path);if(error)throw error;url=data.publicUrl;}
    else if(item.file_url){url=item.file_url;}
    else throw new Error("Le fichier PDF n'est pas disponible.");
    window.open(url,"_blank","noopener");
  }catch(error){showToast(error.message||"Impossible d'ouvrir ce PDF.");}
}
async function loadExams(){
  if(!db){
    exams=[];
    showToast("Supabase n'est pas encore configuré. Les épreuves ne peuvent pas être chargées.");
  }else{
    const {data,error}=await db.from("exams").select("*").eq("status","approved").order("created_at",{ascending:false});
    if(error){console.error(error);showToast("Impossible de charger les épreuves depuis Supabase.");exams=[];}
    else exams=data||[];
  }
  updateYearFilter();renderExams();
}
function readForm(form){
  const data=new FormData(form);
  return {campus:data.get("campus"),level:"Secondaire",class_name:data.get("className"),series:data.get("series").trim(),subject:data.get("subject").trim(),exam_type:data.get("examType"),term:data.get("term"),number:data.get("number"),school_year:data.get("schoolYear").trim(),notes:data.get("notes").trim()};
}
async function submitExam(event){
  event.preventDefault();
  const form=event.currentTarget,button=$("submit-exam"),feedback=$("form-feedback"),file=$("pdf-file").files[0];
  feedback.className="form-feedback";feedback.textContent="";
  if(form.elements.website.value.trim()){feedback.textContent="Envoi refusé.";return;}
  if(Date.now()-formOpenedAt<2500){feedback.textContent="Patiente quelques secondes avant l’envoi.";return;}
  if(!file||file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){feedback.textContent="Choisis un fichier PDF valide.";return;}
  if(file.size>15*1024*1024){feedback.textContent="Le fichier dépasse la limite de 15 Mo.";return;}
  if(!db){feedback.textContent="Supabase n'est pas encore configuré.";return;}
  if(!turnstileToken){feedback.textContent="Valide le contrôle anti-robot avant l’envoi.";return;}
  const fields=readForm(form);button.disabled=true;button.textContent="Vérification et envoi…";
  try{
    const payload=new FormData();payload.append("pdf",file);payload.append("metadata",JSON.stringify(fields));
    payload.append("turnstileToken",turnstileToken);payload.append("website",form.elements.website.value);
    const response=await fetch(SUPABASE_URL+"/functions/v1/submit-exam",{method:"POST",headers:{apikey:SUPABASE_ANON_KEY,Authorization:"Bearer "+SUPABASE_ANON_KEY},body:payload});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"L’envoi a échoué.");
    feedback.textContent="Épreuve publiée ! Elle est maintenant visible par tous les visiteurs.";feedback.classList.add("success");showToast("Épreuve publiée pour tous !");
    turnstileToken="";form.reset();$("file-name").textContent="Aucun fichier sélectionné";
    if(window.turnstile&&turnstileWidgetId!==null)window.turnstile.reset(turnstileWidgetId);
    await loadExams();setTimeout(closeModal,1800);
  }catch(error){console.error(error);feedback.textContent=error.message||"Une erreur est survenue pendant l’envoi.";}
  finally{button.disabled=false;button.innerHTML='Envoyer l’épreuve <span>↗</span>';}
}
function setupTurnstile(){
  if(!window.turnstile||TURNSTILE_SITE_KEY.startsWith("REMPLACER"))return;
  turnstileWidgetId=window.turnstile.render("#turnstile-container",{sitekey:TURNSTILE_SITE_KEY,callback:token=>{turnstileToken=token;},"expired-callback":()=>{turnstileToken="";},"error-callback":()=>{turnstileToken="";showToast("Le contrôle anti-robot a échoué. Réessaie.");}});
}
function resetFilters(){
  selectedCampus="";$("search-input").value="";$("filter-campus").value="";$("filter-class").value="";$("filter-term").value="";$("filter-year").value="";renderCampuses();renderExams();
}
function init(){
  $("year-now").textContent=new Date().getFullYear();
  fillCampusSelects();renderCampuses();
  const turnstileWait=setInterval(()=>{if(window.turnstile){clearInterval(turnstileWait);setupTurnstile();}},300);
  setTimeout(()=>clearInterval(turnstileWait),15000);
  ["open-add","mobile-add","hero-add","banner-add","empty-add"].forEach(id=>$(id).addEventListener("click",openModal));
  ["close-add","cancel-add"].forEach(id=>$(id).addEventListener("click",closeModal));
  $("add-modal").addEventListener("click",event=>{if(event.target===$("add-modal"))closeModal()});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal()});
  $("exam-form").addEventListener("submit",submitExam);
  $("pdf-file").addEventListener("change",event=>{$("file-name").textContent=event.target.files[0]?.name||"Aucun fichier sélectionné"});
  ["search-input","filter-campus","filter-class","filter-term","filter-year"].forEach(id=>$(id).addEventListener(id==="search-input"?"input":"change",()=>{if(id==="filter-campus"){selectedCampus=$(id).value;renderCampuses()}renderExams()}));
  $("reset-filters").addEventListener("click",resetFilters);
  loadExams();
}
document.addEventListener("DOMContentLoaded",init);
