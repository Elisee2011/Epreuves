(() => {
  const URL="https://cigtsvzyeaxluneexnsa.supabase.co";
  const KEY="sb_publishable_AUky4UeugSkRErIjG_yMRw_vetPlrwY";
  const OWNER="eliseeedemagbebavi@gmail.com";
  const client=window.supabase.createClient(URL,KEY,{global:{fetch:(url,options={})=>fetch(url,{...options,cache:"no-store"})}});
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const setFeedback=(id,message,success=false)=>{const el=$(id);if(el){el.textContent=message;el.classList.toggle("success",success)}};
  const adminScreen=$("admin-screen");
  if(!adminScreen)return;
  function route(){
    const active=location.hash==="#admin";
    document.body.classList.toggle("admin-mode",active);
    adminScreen.hidden=!active;
  }
  window.addEventListener("hashchange",route);route();

  async function loadDashboard(){
    $("admin-auth").hidden=true;
    $("admin-dashboard").hidden=false;
    $("admin-logout").hidden=true;
    $("admins-section").hidden=true;
    $("admin-identity").textContent="Mode public temporaire — accès sans connexion";
    await loadExams();
    await loadPublished();
  }

  async function loadPublished(){
    const {data,error}=await client.from("exams").select("*").eq("status","approved").order("created_at",{ascending:false});
    if(error){setFeedback("published-feedback","Impossible de charger les épreuves publiées.");return}
    $("published-count").textContent=(data||[]).length;
    const list=$("published-list");list.innerHTML="";
    if(!data?.length){list.innerHTML='<p class="admin-empty">Aucune épreuve publiée pour le moment.</p>';return}
    data.forEach(item=>{
      const card=document.createElement("article");card.className="admin-item";
      card.innerHTML='<div class="pdf-icon">PDF</div><div class="admin-item-main"><strong>'+escapeHtml(item.subject)+' · '+escapeHtml(item.campus)+'</strong><small>'+escapeHtml(item.class_name)+(item.series?' · Série '+escapeHtml(item.series):'')+' · '+escapeHtml(item.exam_type)+' · '+escapeHtml(item.school_year)+'</small></div><div class="admin-item-actions"><button type="button" data-action="view">Voir PDF</button><button type="button" class="danger" data-action="delete">Supprimer</button></div>';
      card.querySelector('[data-action="view"]').addEventListener("click",()=>{const {data}=client.storage.from("exam-pdfs").getPublicUrl(item.file_path);window.open(data.publicUrl,"_blank","noopener")});
      card.querySelector('[data-action="delete"]').addEventListener("click",()=>deleteExam(item.id));
      list.append(card);
    });
  }

  async function loadExams(){
    const {data,error}=await client.from("exams").select("*").order("created_at",{ascending:false});
    if(error){setFeedback("pending-feedback","Impossible de charger les épreuves.");return}
    const rows=data||[];
    const pending=rows.filter(x=>x.status==="pending");
    $("pending-count").textContent=pending.length;
    $("published-count").textContent=rows.filter(x=>x.status==="approved").length;
    const list=$("pending-list");list.innerHTML="";
    if(!pending.length){list.innerHTML='<p class="admin-empty">Aucune épreuve en attente de validation.</p>';return}
    pending.forEach(item=>{
      const card=document.createElement("article");card.className="admin-item";
      card.innerHTML='<div class="pdf-icon">PDF</div><div class="admin-item-main"><strong>'+escapeHtml(item.subject)+' · '+escapeHtml(item.campus)+'</strong><small>'+escapeHtml(item.class_name)+' · '+escapeHtml(item.exam_type)+' · '+escapeHtml(item.school_year)+' · '+escapeHtml(item.created_at?new Date(item.created_at).toLocaleString("fr-FR"):"")+'</small></div><div class="admin-item-actions"><button type="button" data-action="view">Voir PDF</button><button type="button" data-action="approve">Publier</button><button type="button" data-action="reject">Refuser</button><button type="button" class="danger" data-action="delete">Supprimer</button></div>';
      card.querySelector('[data-action="view"]').addEventListener("click",()=>{const {data}=client.storage.from("exam-pdfs").getPublicUrl(item.file_path);window.open(data.publicUrl,"_blank","noopener")});
      card.querySelector('[data-action="approve"]').addEventListener("click",()=>changeStatus(item.id,"approved"));
      card.querySelector('[data-action="reject"]').addEventListener("click",()=>changeStatus(item.id,"rejected"));
      card.querySelector('[data-action="delete"]').addEventListener("click",()=>deleteExam(item.id));
      list.append(card);
    });
  }

  async function changeStatus(id,status){
    const {error}=await client.from("exams").update({status}).eq("id",id);
    if(error){setFeedback("pending-feedback","La modification a échoué.");return}
    setFeedback("pending-feedback",status==="approved"?"Épreuve publiée.":"Épreuve refusée.",true);
    await loadExams();await loadPublished();
  }
  async function deleteExam(id){
    if(!confirm("Supprimer définitivement cette épreuve et son PDF ?"))return;
    const {data:exam,error:lookupError}=await client.from("exams").select("file_path").eq("id",id).maybeSingle();
    if(lookupError||!exam){setFeedback("pending-feedback","Épreuve introuvable ou suppression impossible.");return}
    const {error:deleteError}=await client.from("exams").delete().eq("id",id);
    if(deleteError){setFeedback("pending-feedback","Suppression impossible.");return}
    if(exam.file_path){
      const {error:storageError}=await client.storage.from("exam-pdfs").remove([exam.file_path]);
      if(storageError)console.warn("PDF non supprimé du stockage:",storageError);
    }
    setFeedback("pending-feedback","Épreuve supprimée.",true);
    setFeedback("published-feedback","Épreuve supprimée.",true);
    await loadExams();await loadPublished();
  }

  async function loadAdmins(){
    const {data,error}=await client.functions.invoke("manage-admins",{body:{action:"list"}});
    if(error||data?.error){setFeedback("admins-feedback",data?.error||"Impossible de charger les administrateurs.");return}
    const list=$("admins-list");list.innerHTML="";
    (data.admins||[]).forEach(admin=>{
      const item=document.createElement("div");item.className="admin-item";
      item.innerHTML='<div class="admin-item-main"><strong>'+escapeHtml(admin.email)+'</strong><small>'+(admin.role==="super_admin"?"Super-administrateur":"Administrateur")+'</small></div>'+(admin.role==="admin"?'<div class="admin-item-actions"><button class="danger" type="button">Retirer</button></div>':"");
      const remove=item.querySelector("button");
      if(remove)remove.addEventListener("click",async()=>{
        if(!confirm("Retirer les droits d'administration de "+admin.email+" ?"))return;
        const {data:result,error:removeError}=await client.functions.invoke("manage-admins",{body:{action:"remove",user_id:admin.user_id}});
        if(removeError||result?.error){setFeedback("admins-feedback",result?.error||"Impossible de retirer cet administrateur.");return}
        setFeedback("admins-feedback","Droits administrateur retirés.",true);await loadAdmins();
      });
      list.append(item);
    });
    if(!(data.admins||[]).length)list.innerHTML='<p class="admin-empty">Aucun administrateur.</p>';
  }

  $("admin-auth-form").addEventListener("submit",async event=>{
    event.preventDefault();setFeedback("admin-auth-feedback","Connexion…");
    const email=$("admin-email").value.trim(),password=$("admin-password").value;
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error){setFeedback("admin-auth-feedback","Connexion impossible. Vérifie ton e-mail et ton mot de passe.");return}
    setFeedback("admin-auth-feedback","");await loadDashboard();
  });
  $("admin-signup").addEventListener("click",async()=>{
    const email=$("admin-email").value.trim().toLowerCase(),password=$("admin-password").value;
    if(email!==OWNER){setFeedback("admin-auth-feedback","La création du compte super-admin est réservée à l'adresse principale.");return}
    if(password.length<8){setFeedback("admin-auth-feedback","Choisis un mot de passe d'au moins 8 caractères.");return}
    setFeedback("admin-auth-feedback","Création du compte…");
    const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/#admin`}});
    if(error){setFeedback("admin-auth-feedback",error.message);return}
    if(data.session){setFeedback("admin-auth-feedback","Compte créé.");await loadDashboard()}
    else setFeedback("admin-auth-feedback","Compte créé. Confirme ton adresse depuis l'e-mail reçu, puis connecte-toi.",true);
  });
  $("admin-add-exam-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const feedback="admin-add-exam-feedback",submit=$("admin-add-exam-submit");
    const file=$("new-exam-pdf").files[0];
    if(!file){setFeedback(feedback,"Sélectionne un fichier PDF.");return}
    if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){setFeedback(feedback,"Le fichier doit être au format PDF.");return}
    if(file.size>15*1024*1024){setFeedback(feedback,"Le PDF dépasse la limite de 15 Mo.");return}
    const campus=$("new-exam-campus").value,className=$("new-exam-class").value;
    const subject=$("new-exam-subject").value.trim(),year=$("new-exam-year").value.trim();
    if(!/^\d{4}-\d{4}$/.test(year)){setFeedback(feedback,"Indique une année scolaire au format 2026-2027.");return}
    submit.disabled=true;submit.textContent="Importation…";setFeedback(feedback,"Envoi du PDF en cours…");
    const path="admin/"+Date.now()+"-"+crypto.randomUUID()+".pdf";
    try{
      const {error:uploadError}=await client.storage.from("exam-pdfs").upload(path,file,{contentType:"application/pdf",upsert:false});
      if(uploadError)throw uploadError;
      const type=$("new-exam-type").value;
      const number=type==="Composition"?"composition":$("new-exam-number").value;
      const {error:insertError}=await client.from("exams").insert({
        campus,level:"Secondaire",class_name:className,series:$("new-exam-series").value.trim()||null,
        subject,exam_type:type,term:Number($("new-exam-term").value),number,school_year:year,
        notes:$("new-exam-notes").value.trim()||null,file_path:path,status:"approved"
      });
      if(insertError){
        await client.storage.from("exam-pdfs").remove([path]);
        throw insertError;
      }
      $("admin-add-exam-form").reset();
      setFeedback(feedback,"Épreuve ajoutée et publiée avec succès.",true);
      await loadExams();await loadPublished();
    }catch(error){
      console.error("Admin exam upload:",error);
      setFeedback(feedback,error?.message||"L'ajout de l'épreuve a échoué. Réessaie.");
    }finally{
      submit.disabled=false;submit.textContent="Importer et publier";
    }
  });
  $("admin-logout").addEventListener("click",async()=>{await client.auth.signOut();await loadDashboard()});
  $("add-admin-form").addEventListener("submit",async event=>{
    event.preventDefault();const email=$("new-admin-email").value.trim();
    const {data,error}=await client.functions.invoke("manage-admins",{body:{action:"add",email}});
    if(error||data?.error){setFeedback("admins-feedback",data?.error||"Ajout impossible.");return}
    $("new-admin-email").value="";setFeedback("admins-feedback",data.message||"Administrateur ajouté.",true);await loadAdmins();
  });
  client.auth.onAuthStateChange(()=>{if(location.hash==="#admin")setTimeout(loadDashboard,0)});
  loadDashboard();
})();