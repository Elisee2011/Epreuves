const $=id=>document.getElementById(id);
const state={pages:[],busy:false};
const toast=message=>{const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3600)};
const prettySize=bytes=>bytes<1024*1024?(bytes/1024).toFixed(0)+" Ko":(bytes/1024/1024).toFixed(1)+" Mo";
function addFiles(files){for(const file of [...files]){if(!file.type.startsWith("image/"))continue;if(state.pages.length>=12){toast("Maximum : 12 pages par document.");break}if(file.size>18*1024*1024){toast(file.name+" dépasse 18 Mo.");continue}const page={id:crypto.randomUUID(),file,url:URL.createObjectURL(file),words:[],lines:[],text:"",width:0,height:0};state.pages.push(page)}renderPages();$("process-btn").disabled=!state.pages.length||state.busy}
function renderPages(){$("pages").innerHTML="";state.pages.forEach((page,index)=>{const card=document.createElement("div");card.className="page-card";card.innerHTML='<button class="remove-page" type="button" aria-label="Retirer la page">×</button><img src="'+page.url+'" alt="Aperçu de la page '+(index+1)+'"><strong>Page '+(index+1)+'</strong><small>'+prettySize(page.file.size)+'</small>';card.querySelector("button").addEventListener("click",()=>{URL.revokeObjectURL(page.url);state.pages.splice(index,1);renderPages();$("process-btn").disabled=!state.pages.length||state.busy});$("pages").append(card)})}
function setProgress(percent,label){$("progress-wrap").hidden=false;$("progress-bar").style.width=Math.max(0,Math.min(100,percent))+"%";$("progress-label").textContent=label}
function groupLines(words){const sorted=[...words].sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);const lines=[];for(const word of sorted){if(!word.text||!word.text.trim())continue;const mid=(word.bbox.y0+word.bbox.y1)/2;let line=lines.find(item=>Math.abs(item.mid-mid)<Math.max(9,(word.bbox.y1-word.bbox.y0)*.55));if(!line){line={mid,words:[]};lines.push(line)}line.words.push(word)}lines.sort((a,b)=>a.mid-b.mid);lines.forEach(line=>line.words.sort((a,b)=>a.bbox.x0-b.bbox.x0));return lines}
async function prepareOCRImage(page){
  const image=await loadImage(page.url);
  const maxSide=1600,ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*ratio)),height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
  page.width=width;page.height=height;page.lineMarks=detectRules(canvas);
  return await new Promise(resolve=>canvas.toBlob(blob=>resolve(blob||page.file),"image/jpeg",.82));
}
async function runOCR(){
  if(state.busy||!state.pages.length)return;
  if(!window.Tesseract){toast("Le moteur de reconnaissance ne s'est pas chargé. Vérifie ta connexion puis recharge la page.");return}
  state.busy=true;$("process-btn").disabled=true;$("status").textContent="Préparation des images…";$("results").hidden=true;
  setProgress(0,"Préparation des pages pour accélérer la reconnaissance…");
  let worker;
  try{
    worker=await Tesseract.createWorker("fra",1,{logger:m=>{
      const labels={"loading tesseract core":"Chargement du moteur…","initializing tesseract":"Initialisation…","loading language traineddata":"Téléchargement du modèle français…","initializing api":"Préparation de la reconnaissance…"};
      if(labels[m.status])setProgress(2,labels[m.status]);
      if(m.status==="recognizing text"){
        const p=(m.progress||0)*100;
        setProgress(((state.currentPage||0)+p/100)/state.pages.length*100,"Lecture de la page "+((state.currentPage||0)+1)+"/"+state.pages.length+" — "+Math.round(p)+"%");
      }
    }});
    await worker.setParameters({preserve_interword_spaces:"1"});
    for(let i=0;i<state.pages.length;i++){
      const page=state.pages[i];state.currentPage=i;
      $("status").textContent="Analyse de la page "+(i+1)+" sur "+state.pages.length;
      setProgress(i/state.pages.length*100,"Optimisation de la page "+(i+1)+"/"+state.pages.length+"…");
      const optimized=await prepareOCRImage(page);
      const result=await worker.recognize(optimized);
      page.words=(result.data.words||[]).filter(w=>w.text&&w.text.trim());
      page.lines=groupLines(page.words);
      page.text=page.lines.map(line=>line.words.map(w=>w.text).join(" ")).join("\n");
    }
    await worker.terminate();worker=null;
    renderEditors();$("results").hidden=false;$("status").textContent="Reconnaissance terminée";
    setProgress(100,"Toutes les pages ont été analysées.");$("results").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);if(worker)await worker.terminate();
    $("status").textContent="Erreur pendant la reconnaissance";
    toast("La reconnaissance a échoué. Vérifie ta connexion et essaie avec moins de pages.");
  }finally{state.busy=false;state.currentPage=0;$("process-btn").disabled=!state.pages.length}
}
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url})}
function detectRules(source){const max=900,ratio=Math.min(1,max/source.width,max/source.height),w=Math.max(1,Math.round(source.width*ratio)),h=Math.max(1,Math.round(source.height*ratio));const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(source,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;const row=[],col=[];for(let y=0;y<h;y++){let n=0;for(let x=0;x<w;x++){const p=(y*w+x)*4;if((data[p]+data[p+1]+data[p+2])/3<105)n++}if(n>w*.28)row.push(y)}for(let x=0;x<w;x++){let n=0;for(let y=0;y<h;y++){const p=(y*w+x)*4;if((data[p]+data[p+1]+data[p+2])/3<105)n++}if(n>h*.22)col.push(x)}const group=a=>{const out=[];for(const v of a){const last=out[out.length-1];if(last&&v-last.end<=3)last.end=v;else out.push({start:v,end:v})}return out.filter(v=>v.end-v.start<=8).map(v=>(v.start+v.end)/2)};return{width:w,height:h,rows:group(row),cols:group(col)}}
function renderEditors(){$("editors").innerHTML="";state.pages.forEach((page,index)=>{const card=document.createElement("div");card.className="editor-card";const count=page.words.length;card.innerHTML='<div class="editor-head"><b>Page '+(index+1)+'</b><span>'+count+' mots reconnus</span></div><textarea aria-label="Texte reconnu de la page '+(index+1)+'" spellcheck="false"></textarea>';const area=card.querySelector("textarea");area.value=page.text;area.addEventListener("input",()=>{page.editedText=area.value});$("editors").append(card)})}
async function addImagePage(doc,page,index){
  const image=await loadImage(page.url);
  const maxSide=2600,ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*ratio));
  const height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
  const data=canvas.toDataURL("image/jpeg",.94);
  const landscape=width>height,pw=landscape?297:210,ph=landscape?210:297,margin=3;
  if(index)doc.addPage("a4",landscape?"landscape":"portrait");
  else if(landscape)doc=new jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
  const scale=Math.min((pw-2*margin)/width,(ph-2*margin)/height);
  const w=width*scale,h=height*scale,x=(pw-w)/2,y=(ph-h)/2;
  doc.addImage(data,"JPEG",x,y,w,h,undefined,"FAST");
  return doc;
}
async function exportPDF(){
  if(!window.jspdf?.jsPDF){toast("Le générateur PDF ne s'est pas chargé.");return}
  if(!state.pages.length){toast("Ajoute au moins une page.");return}
  try{
    let doc=new jspdf.jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
    for(let i=0;i<state.pages.length;i++){
      doc=await addImagePage(doc,state.pages[i],i);
      $("status").textContent="Préparation du PDF — page "+(i+1)+"/"+state.pages.length;
    }
    const blob=doc.output("blob");
    if(window.parent!==window)window.parent.postMessage({type:"EPREUVESCAN_PDF",blob,name:"epreuvescan-document.pdf"},"*");
    doc.save("epreuvescan-document.pdf");
    $("status").textContent="PDF fidèle aux photos originales";
    toast(window.parent!==window?"PDF fidèle transmis au formulaire et téléchargé.":"PDF créé en conservant les pages originales.");
  }catch(error){console.error(error);toast("Impossible de créer le PDF. Réessaie avec des photos moins volumineuses.")}
}
$("camera-input").addEventListener("change",e=>{addFiles(e.target.files);e.target.value=""});$("file-input").addEventListener("change",e=>{addFiles(e.target.files);e.target.value=""});$("process-btn").addEventListener("click",runOCR);$("export-btn").addEventListener("click",exportPDF);
const drop=$("dropzone");["dragenter","dragover"].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add("drag")}));["dragleave","drop"].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove("drag")}));drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));