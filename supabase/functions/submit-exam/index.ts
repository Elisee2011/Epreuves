import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async (req) => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
 if(req.method!=="POST") return json({error:"Méthode non autorisée."},405);
 try {
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),secret=Deno.env.get("TURNSTILE_SECRET_KEY");
  if(!url||!serviceKey||!secret) return json({error:"Configuration serveur incomplète."},500);
  const form=await req.formData();
  if(String(form.get("website")||"").trim()) return json({error:"Envoi refusé."},400);
  const token=String(form.get("turnstileToken")||"");
  if(!token) return json({error:"Contrôle anti-robot manquant."},400);
  const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";
  const check=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret,response:token,...(ip?{remoteip:ip}:{})})});
  const verdict=await check.json();
  if(!verdict.success) return json({error:"Vérification anti-robot refusée. Réessaie."},403);
  const file=form.get("pdf");
  if(!(file instanceof File)||file.type!=="application/pdf"||file.size<1||file.size>15*1024*1024) return json({error:"Le fichier doit être un PDF de 15 Mo maximum."},400);
  let m; try{m=JSON.parse(String(form.get("metadata")||"{}"));}catch{return json({error:"Informations invalides."},400);}
  const campuses=["Lomé","Atakpamé","Kara","Sokodé","Dapaong","Tsévié","Kpalimé"];
  if(!campuses.includes(String(m.campus))||!["Seconde","Première","Terminale"].includes(String(m.class_name))||!String(m.subject||"").trim()||!["Devoir","Composition"].includes(String(m.exam_type))||![1,2,3].includes(Number(m.term))||!/^20\d{2}-20\d{2}$/.test(String(m.school_year||""))) return json({error:"Certaines informations sont invalides."},400);
  const admin=createClient(url,serviceKey);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip||"unknown"));
  const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
  const {data:allowed,error:limitError}=await admin.rpc("check_exam_submission_limit",{p_ip_hash:hash});
  if(limitError) throw limitError;
  if(!allowed) return json({error:"Maximum 4 dépôts en 10 minutes. Réessaie plus tard."},429);
  const id=crypto.randomUUID();
  const safeName=file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"-")||"epreuve.pdf";
  const path="files/"+id+"/"+safeName;
  const {error:uploadError}=await admin.storage.from("exam-pdfs").upload(path,file,{contentType:"application/pdf",upsert:false});
  if(uploadError) throw uploadError;
  const row={campus:m.campus,level:"Secondaire",class_name:m.class_name,series:m.series||null,subject:String(m.subject).trim(),exam_type:m.exam_type,term:Number(m.term),number:String(m.number||"other"),school_year:m.school_year,notes:m.notes||null,file_path:path,status:"approved"};
  const {data,error:insertError}=await admin.from("exams").insert(row).select().single();
  if(insertError){await admin.storage.from("exam-pdfs").remove([path]);throw insertError;}
  return json({success:true,id:data.id});
 }catch(error){console.error(error);return json({error:"Erreur serveur pendant le dépôt. Réessaie plus tard."},500);}
});
