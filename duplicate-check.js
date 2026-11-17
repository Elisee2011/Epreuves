(() => {
  const db = window.supabase.createClient(
    "https://cigtsvzyeaxluneexnsa.supabase.co",
    "sb_publishable_AUky4UeugSkRErIjG_yMRw_vetPlrwY",
    {global:{fetch:(url,options={})=>fetch(url,{...options,cache:"no-store"})}}
  );
  const $ = id => document.getElementById(id);
  const form = $("admin-add-exam-form");
  if (!form) return;
  const review = document.createElement("section");
  review.id = "duplicate-review";
  review.className = "duplicate-review";
  review.hidden = true;
  form.insertAdjacentElement("afterend", review);

  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase();
  const keys = ["campus","class_name","series","subject","exam_type","term","number","school_year"];
  const keyOf = x => keys.map(k=>norm(x[k])).join("|");
  const draft = () => {
    const type=$("new-exam-type").value;
    return {
      campus:$("new-exam-campus").value,
      class_name:$("new-exam-class").value,
      series:$("new-exam-series").value.trim()||null,
      subject:$("new-exam-subject").value.trim(),
      exam_type:type,term:Number($("new-exam-term").value),
      number:type==="Composition"?"composition":$("new-exam-number").value,
      school_year:$("new-exam-year").value.trim(),
      notes:$("new-exam-notes").value.trim()||null
    };
  };
  const label = x => [x.campus,x.class_name+(x.series?" · Série "+x.series:""),x.subject,x.exam_type,
    "Trimestre "+x.term,x.number==="composition"?"Composition":x.number==="1"?"1er devoir":x.number==="2"?"2e devoir":x.number,x.school_year].filter(Boolean).join(" · ");
  const feedback = (msg,ok=false) => {const e=$("admin-add-exam-feedback");e.textContent=msg;e.classList.toggle("success",ok);};
  const busy = (on,txt) => {const b=$("admin-add-exam-submit");b.disabled=on;b.textContent=txt;};
  const validPdf = file => {
    if(!file){feedback("Sélectionne un fichier PDF.");return false;}
    if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){feedback("Le fichier doit être au format PDF.");return false;}
    if(file.size>15*1024*1024){feedback("Le PDF dépasse la limite de 15 Mo.");return false;}
    return true;
  };
  const viewPdf = path => window.open(db.storage.from("exam-pdfs").getPublicUrl(path).data.publicUrl,"_blank","noopener");

  function showMatches(matches) {
    const d=draft();
    let html='<div class="duplicate-review-heading"><span class="duplicate-eyebrow">VÉRIFICATION AVANT PUBLICATION</span><h3>'+
      (matches.length>1?"Plusieurs épreuves avec les mêmes identifiants existent déjà":"Une épreuve avec les mêmes identifiants existe déjà")+
      '</h3><p>Compare les informations. Tu peux modifier l’ancienne épreuve, corriger la nouvelle dans le formulaire, ou confirmer qu’il s’agit d’un autre document.</p></div>';
    html+='<div class="duplicate-new-card"><div class="duplicate-card-top"><strong>Nouvelle épreuve</strong><span class="duplicate-tag duplicate-tag-new">À publier</span></div><p>'+esc(label(d))+'</p><small>PDF sélectionné : '+esc($("new-exam-pdf").files[0]?.name||"Aucun fichier")+'</small></div>';
    html+='<div class="duplicate-existing-list">';
    matches.forEach(x=>{
      html+='<article class="duplicate-existing-card"><div class="duplicate-card-top"><strong>Épreuve déjà enregistrée</strong><span class="duplicate-tag">Existante</span></div><p>'+esc(label(x))+'</p><small>Statut : '+esc(x.status==="approved"?"Publiée":x.status==="pending"?"En attente":x.status)+'</small><div class="duplicate-actions"><button type="button" class="duplicate-secondary" data-view="'+esc(x.id)+'">Voir le PDF existant</button><button type="button" class="duplicate-secondary" data-edit="'+esc(x.id)+'">Modifier cette épreuve</button></div></article>';
    });
    html+='</div><div class="duplicate-decision"><button type="button" class="duplicate-secondary" id="duplicate-edit-new">Modifier la nouvelle épreuve</button><button type="button" class="duplicate-primary" id="duplicate-keep-new">La nouvelle est différente : publier quand même</button><button type="button" class="duplicate-cancel" id="duplicate-cancel">Annuler l’ajout</button></div><div id="duplicate-edit-panel"></div>';
    review.innerHTML=html;
    review.hidden=false;
    review.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{const x=matches.find(v=>v.id===b.dataset.view);if(x?.file_path)viewPdf(x.file_path);}));
    review.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{const x=matches.find(v=>v.id===b.dataset.edit);if(x)editExisting(x);}));
    $("duplicate-edit-new").addEventListener("click",()=>{review.hidden=true;$("new-exam-subject").focus();feedback("Modifie les informations de la nouvelle épreuve, puis relance la vérification.");});
    $("duplicate-keep-new").addEventListener("click",()=>publishNew(true));
    $("duplicate-cancel").addEventListener("click",()=>{review.hidden=true;feedback("Ajout annulé : aucune nouvelle épreuve n’a été publiée.");});
    review.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function editExisting(item) {
    const panel=$("duplicate-edit-panel");
    const campus=["Lomé","Atakpamé","Kara","Sokodé","Dapaong","Tsévié","Kpalimé"];
    const classes=["Seconde","Première","Terminale"];
    const opts=(arr,value)=>arr.map(v=>'<option '+(v===value?"selected":"")+'>'+v+'</option>').join("");
    panel.innerHTML='<form class="duplicate-edit-form" id="duplicate-existing-form"><div class="duplicate-edit-heading"><strong>Modifier l’épreuve existante</strong><span>Les changements seront appliqués à l’épreuve déjà enregistrée.</span></div><div class="duplicate-edit-grid">'+
      '<label>Établissement<select name="campus" required>'+opts(campus,item.campus)+'</select></label>'+
      '<label>Classe<select name="class_name" required>'+opts(classes,item.class_name)+'</select></label>'+
      '<label>Série<input name="series" maxlength="20" value="'+esc(item.series||"")+'"></label>'+
      '<label>Matière<input name="subject" maxlength="80" required value="'+esc(item.subject)+'"></label>'+
      '<label>Type<select name="exam_type">'+opts(["Devoir","Composition"],item.exam_type)+'</select></label>'+
      '<label>Trimestre<select name="term">'+[1,2,3].map(v=>'<option value="'+v+'" '+(Number(item.term)===v?"selected":"")+'>'+v+'</option>').join("")+'</select></label>'+
      '<label>Numéro<select name="number">'+[['1','1er devoir'],['2','2e devoir'],['composition','Composition'],['other','Autre évaluation']].map(v=>'<option value="'+v[0]+'" '+(item.number===v[0]?"selected":"")+'>'+v[1]+'</option>').join("")+'</select></label>'+
      '<label>Année scolaire<input name="school_year" required pattern="\\d{4}-\\d{4}" value="'+esc(item.school_year)+'"></label>'+
      '<label class="duplicate-edit-wide">Informations complémentaires<textarea name="notes" maxlength="500" rows="2">'+esc(item.notes||"")+'</textarea></label>'+
      '<label class="duplicate-edit-wide">Remplacer le PDF (facultatif)<input name="pdf" type="file" accept="application/pdf,.pdf"><small>Sans nouveau fichier, le PDF actuel sera conservé.</small></label></div>'+
      '<div class="duplicate-edit-actions"><button class="duplicate-primary" type="submit">Enregistrer les modifications</button><button class="duplicate-secondary" type="button" id="duplicate-edit-close">Fermer</button></div><p class="admin-feedback" id="duplicate-edit-feedback" role="status"></p></form>';
    $("duplicate-edit-close").addEventListener("click",()=>{panel.innerHTML="";});
    $("duplicate-existing-form").addEventListener("submit",async ev=>{
      ev.preventDefault();
      const f=ev.currentTarget,btn=f.querySelector('[type="submit"]'),status=$("duplicate-edit-feedback");
      const v=Object.fromEntries(new FormData(f).entries()),pdf=f.elements.pdf.files[0];
      if(pdf&&!validPdf(pdf)){status.textContent=$("admin-add-exam-feedback").textContent;return;}
      if(!/^\d{4}-\d{4}$/.test(v.school_year)){status.textContent="Année scolaire invalide. Exemple : 2026-2027.";return;}
      btn.disabled=true;btn.textContent="Enregistrement…";
      let newPath=null;
      try{
        if(pdf){
          newPath="admin/"+Date.now()+"-"+crypto.randomUUID()+".pdf";
          const up=await db.storage.from("exam-pdfs").upload(newPath,pdf,{contentType:"application/pdf",upsert:false});
          if(up.error)throw up.error;
        }
        const changes={campus:v.campus,class_name:v.class_name,series:v.series.trim()||null,subject:v.subject.trim(),
          exam_type:v.exam_type,term:Number(v.term),number:v.exam_type==="Composition"?"composition":v.number,
          school_year:v.school_year.trim(),notes:v.notes.trim()||null};
        if(newPath)changes.file_path=newPath;
        const result=await db.from("exams").update(changes).eq("id",item.id);
        if(result.error)throw result.error;
        if(newPath&&item.file_path){const rm=await db.storage.from("exam-pdfs").remove([item.file_path]);if(rm.error)console.warn("Ancien PDF conservé :",rm.error);}
        status.textContent="Épreuve existante mise à jour.";status.classList.add("success");
        const result2=await db.from("exams").select("*").neq("status","rejected");
        if(result2.error)throw result2.error;
        const remaining=(result2.data||[]).filter(x=>keyOf(x)===keyOf(draft()));
        if(remaining.length)showMatches(remaining);
        else{review.hidden=true;feedback("L’ancienne épreuve a été modifiée. Vérifie les identifiants de la nouvelle avant de la publier.",true);}
        window.dispatchEvent(new Event("focus"));
      }catch(err){
        if(newPath)await db.storage.from("exam-pdfs").remove([newPath]);
        status.textContent=err?.message||"La modification a échoué. Réessaie.";
      }finally{btn.disabled=false;btn.textContent="Enregistrer les modifications";}
    });
  }

  async function findMatches(d) {
    const r=await db.from("exams").select("*").neq("status","rejected");
    if(r.error)throw r.error;
    return (r.data||[]).filter(x=>keyOf(x)===keyOf(d));
  }

  async function publishNew(confirmed) {
    const file=$("new-exam-pdf").files[0],d=draft();
    if(!validPdf(file))return;
    if(!d.campus||!d.class_name||!d.subject||!/^\d{4}-\d{4}$/.test(d.school_year)){feedback("Vérifie les champs obligatoires et le format de l’année scolaire.");return;}
    busy(true,"Importation…");feedback("Envoi du PDF en cours…");
    const path="admin/"+Date.now()+"-"+crypto.randomUUID()+".pdf";
    try{
      const up=await db.storage.from("exam-pdfs").upload(path,file,{contentType:"application/pdf",upsert:false});
      if(up.error)throw up.error;
      const ins=await db.from("exams").insert({...d,level:"Secondaire",file_path:path,status:"approved"});
      if(ins.error){await db.storage.from("exam-pdfs").remove([path]);throw ins.error;}
      form.reset();review.hidden=true;
      feedback(confirmed?"Nouvelle épreuve publiée après confirmation qu’il s’agit d’un document différent.":"Épreuve ajoutée et publiée avec succès.",true);
      window.dispatchEvent(new Event("focus"));
    }catch(err){console.error("Publication épreuve :",err);feedback(err?.message||"L’ajout de l’épreuve a échoué. Réessaie.");}
    finally{busy(false,"Importer et publier");}
  }

  // Capture avant le gestionnaire historique pour vérifier les doublons avant tout upload.
  form.addEventListener("submit",async ev=>{
    ev.preventDefault();ev.stopImmediatePropagation();
    if(!form.reportValidity())return;
    if(!validPdf($("new-exam-pdf").files[0]))return;
    const d=draft();
    if(!/^\d{4}-\d{4}$/.test(d.school_year)){feedback("Indique une année scolaire au format 2026-2027.");return;}
    busy(true,"Vérification…");feedback("Recherche d’une épreuve avec les mêmes identifiants…");
    try{
      const matches=await findMatches(d);
      busy(false,"Importer et publier");
      if(matches.length){feedback("Une correspondance a été trouvée. Vérifie les épreuves avant de continuer.");showMatches(matches);}
      else await publishNew(false);
    }catch(err){
      console.error("Vérification doublons :",err);busy(false,"Importer et publier");
      feedback("La vérification des doublons n’a pas abouti. Aucune épreuve n’a été publiée. Réessaie.");
    }
  },true);
})();