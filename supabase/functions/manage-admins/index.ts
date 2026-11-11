import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
  if(req.method!=="POST") return json({error:"Méthode non autorisée."},405);
  try {
    const url=Deno.env.get("SUPABASE_URL")!, serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(!token) return json({error:"Connexion requise."},401);
    const admin=createClient(url,serviceKey);
    const {data:authData,error:authError}=await admin.auth.getUser(token);
    if(authError||!authData.user) return json({error:"Session invalide."},401);
    const {data:role,error:roleError}=await admin.from("admins").select("role").eq("user_id",authData.user.id).maybeSingle();
    if(roleError) throw roleError;
    if(!role) return json({error:"Accès réservé aux administrateurs."},403);
    const body=await req.json().catch(()=>({}));
    if(body.action==="delete_exam") {
      const examId=String(body.exam_id||"");
      if(!examId) return json({error:"Épreuve introuvable."},400);
      const {data:exam,error:examError}=await admin.from("exams").select("file_path").eq("id",examId).maybeSingle();
      if(examError) throw examError;
      if(!exam) return json({error:"Épreuve introuvable."},404);
      if(exam.file_path) {
        const {error:storageError}=await admin.storage.from("exam-pdfs").remove([exam.file_path]);
        if(storageError) throw storageError;
      }
      const {error:deleteError}=await admin.from("exams").delete().eq("id",examId);
      if(deleteError) throw deleteError;
      return json({success:true});
    }
    if(role.role!=="super_admin") return json({error:"Action réservée au super-administrateur."},403);
    if(body.action==="list") {
      const {data,error}=await admin.from("admins").select("user_id,role,created_at").order("created_at");
      if(error) throw error;
      const {data:usersData,error:usersError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
      if(usersError) throw usersError;
      const users=new Map(usersData.users.map(u=>[u.id,u.email||"Adresse inconnue"]));
      return json({admins:(data||[]).map(a=>({...a,email:users.get(a.user_id)||"Compte introuvable"}))});
    }
    if(body.action==="add") {
      const email=String(body.email||"").trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\\.[^\s@]+$/.test(email)) return json({error:"Adresse e-mail invalide."},400);
      if(email==="eliseeedemagbebavi@gmail.com") return json({error:"Ce compte est déjà le super-administrateur."},400);
      const {data:usersData,error:usersError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
      if(usersError) throw usersError;
      let target=usersData.users.find(u=>(u.email||"").toLowerCase()===email);
      if(!target) {
        const {data:inviteData,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email);
        if(inviteError) throw inviteError;
        target=inviteData.user;
      }
      if(!target) return json({error:"Impossible de créer l'invitation."},500);
      const {error}=await admin.from("admins").upsert({user_id:target.id,role:"admin"});
      if(error) throw error;
      return json({success:true,message:"Administrateur ajouté. Une invitation a été envoyée si le compte n'existait pas encore."});
    }
    if(body.action==="remove") {
      const userId=String(body.user_id||"");
      if(!userId||userId===authData.user.id) return json({error:"Action impossible sur ce compte."},400);
      const {data:target,error:targetError}=await admin.from("admins").select("role").eq("user_id",userId).maybeSingle();
      if(targetError) throw targetError;
      if(!target||target.role!=="admin") return json({error:"Administrateur introuvable ou protégé."},404);
      const {error}=await admin.from("admins").delete().eq("user_id",userId);
      if(error) throw error;
      return json({success:true});
    }
    return json({error:"Action inconnue."},400);
  } catch(error) { console.error(error); return json({error:"Une erreur serveur est survenue."},500); }
});