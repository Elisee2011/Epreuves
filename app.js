/* Épreuves — configuration Supabase
   Pour activer le partage entre tous les visiteurs, renseigne l'URL et la clé anon
   de ton projet Supabase ci-dessous. Ne mets JAMAIS une clé service_role ici. */
const SUPABASE_URL = "https://cigtsvzyeaxluneexnsa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AUky4UeugSkRErIjG_yMRw_vetPlrwY";
const BUCKET = "exam-pdfs";
const TURNSTILE_SITE_KEY = "0x4AAAAAAF4asAUByI_YNa1e";

const campuses = ["Lomé","Atakpamé","Kara","Sokodé","Dapaong","Tsévié","Kpalimé"];
const campusIcons = ["⌂","⌁","◇","▦","✳","⌖","⌂"];
const $ = (id) => document.getElementById(id);
const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const db = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }) } }) : null;
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
function fillCampusSelects(){
  const select=$("filter-campus");
  if(!select)return;
  campuses.forEach(name=>{
    const option=document.createElement("option");
    option.value=name;
    option.textContent="Lycée Scientifique de "+name;
    select.append(option);
  });
}
function updateStats(){
  const subjects=new Set(exams.map(item=>item.subject).filter(Boolean));
  $("stat-campus").textContent=String(campuses.length).padStart(2,"0");
  $("stat-exams").textContent=exams.length.toLocaleString("fr-FR");
  $("stat-subjects").textContent=subjects.size.toLocaleString("fr-FR");
}
function setupRevealAnimations(){
  const targets=document.querySelectorAll(".section,.stats-row,.hero-content,.hero-art,.exam-card,.campus-card");
  targets.forEach((element,index)=>{
    if(element.classList.contains("reveal-ready"))return;
    element.classList.add("reveal-ready");
    element.style.setProperty("--reveal-delay",(index%4)*75+"ms");
  });
  if(!("IntersectionObserver" in window)){
    targets.forEach(element=>element.classList.add("is-visible"));
    return;
  }
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.12});
  targets.forEach(element=>observer.observe(element));
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
  if(String(number)==="composition")return "Composition";
  if(String(number)==="other")return "Autre évaluation";
  return ({"1":"1er devoir","2":"2e devoir"})[String(number)]||(String(number)||type||"Évaluation");
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
  setupRevealAnimations();
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
let publicLoadInProgress = null;
let publicRealtimeChannel = null;
let publicRefreshTimer = null;
let lastPublicRefresh = 0;

async function loadExams({silent=false}={}){
  if(publicLoadInProgress)return publicLoadInProgress;
  publicLoadInProgress=(async()=>{
    if(!db){
      if(!silent)showToast("Supabase n'est pas encore configuré. Les épreuves ne peuvent pas être chargées.");
      return;
    }
    try{
      const {data,error}=await db.from("exams").select("*").eq("status","approved").order("created_at",{ascending:false});
      if(error)throw error;
      // Ne remplacer la liste qu'après une réponse valide.
      exams=Array.isArray(data)?data:[];
      lastPublicRefresh=Date.now();
      updateYearFilter();updateStats();renderExams();setupRevealAnimations();
    }catch(error){
      console.error("Public exams refresh:",error);
      if(!silent)showToast("Impossible d'actualiser les épreuves. Réessaie dans un instant.");
    }
  })();
  try{await publicLoadInProgress;}finally{publicLoadInProgress=null;}
}

function schedulePublicRefresh(){
  clearTimeout(publicRefreshTimer);
  publicRefreshTimer=setTimeout(()=>loadExams({silent:true}),350);
}

function setupPublicExamSync(){
  if(!db)return;
  publicRealtimeChannel=db.channel("public-exams-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"exams"},schedulePublicRefresh)
    .subscribe(status=>{
      if(status==="SUBSCRIBED")loadExams({silent:true});
    });
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden && Date.now()-lastPublicRefresh>3000)loadExams({silent:true});
  });
  window.addEventListener("focus",()=>{
    if(Date.now()-lastPublicRefresh>3000)loadExams({silent:true});
  });
  window.addEventListener("pageshow",()=>loadExams({silent:true}));
  window.addEventListener("online",()=>loadExams({silent:true}));
  setInterval(()=>{
    if(!document.hidden)loadExams({silent:true});
  },60000);
}

function resetFilters(){
  ["search-input","filter-campus","filter-class","filter-term","filter-year"].forEach(id=>{
    const field=$(id);if(field)field.value="";
  });
  selectedCampus="";
  renderCampuses();
  renderExams();
  loadExams({silent:true});
}

function setupPageLoader(){
  const loader=$("site-loader");
  if(!loader)return;
  const bar=loader.querySelector(".loader-progress span");
  let pageLoaded=document.readyState==="complete";
  let appReady=false;
  let hidingScheduled=false;
  let removed=false;
  let progress=5;
  const setProgress=value=>{
    progress=Math.max(progress,Math.min(100,value));
    if(bar)bar.style.transform=`scaleX(${progress/100})`;
    loader.setAttribute("aria-label",`Chargement du site : ${Math.round(progress)} %`);
  };
  setProgress(pageLoaded?70:5);
  const hide=()=>{
    if(removed)return;
    removed=true;
    setProgress(100);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.body.classList.add("site-ready");
      loader.classList.add("is-hidden");
      setTimeout(()=>loader.remove(),550);
    }));
  };
  const tryHide=()=>{
    if(!pageLoaded||!appReady||hidingScheduled)return;
    hidingScheduled=true;
    hide();
  };
  if(!pageLoaded){
    document.addEventListener("DOMContentLoaded",()=>setProgress(35),{once:true});
    window.addEventListener("load",()=>{
      pageLoaded=true;
      setProgress(75);
      tryHide();
    },{once:true});
  }
  window.markAppReady=()=>{
    appReady=true;
    // Le délai de sécurité autorise aussi la fermeture si l'événement window.load est bloqué.
    pageLoaded=true;
    setProgress(92);
    tryHide();
  };
  // Si l'application rencontre une erreur bloquante, ne pas masquer le site indéfiniment.
  window.addEventListener("error",()=>{ if(pageLoaded&&appReady)tryHide(); });
}

function init(){
  setupPageLoader();
  $("year-now").textContent=new Date().getFullYear();
  fillCampusSelects();renderCampuses();
  ["search-input","filter-campus","filter-class","filter-term","filter-year"].forEach(id=>$(id).addEventListener(id==="search-input"?"input":"change",()=>{if(id==="filter-campus"){selectedCampus=$(id).value;renderCampuses()}renderExams()}));
  $("reset-filters").addEventListener("click",resetFilters);
  setupRevealAnimations();
  setupPublicExamSync();
  // Sécurité réseau : ne jamais laisser l'écran de chargement bloqué si Supabase ne répond pas.
  const loaderFallback=setTimeout(()=>window.markAppReady?.(),2000);
  loadExams().finally(()=>{
    clearTimeout(loaderFallback);
    window.markAppReady?.();
  });
}
document.addEventListener("DOMContentLoaded",init);
