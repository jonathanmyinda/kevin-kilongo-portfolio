import { useEffect, useRef, useState } from 'react'
import Icon from './AdminIcon'
const size=bytes=>`${(bytes/1000000).toLocaleString('fr-FR',{maximumFractionDigits:2})} Mo`
export default function PortfolioPDF({value,downloadName,initial,api,onSelect,onBusy,onError}){
 const [library,setLibrary]=useState([]),[working,setWorking]=useState(false),[progress,setProgress]=useState(0),[status,setStatus]=useState(''),[failed,setFailed]=useState(false),[link,setLink]=useState(null)
 const file=useRef(null),intent=useRef(null),upload=useRef(null)
 useEffect(()=>{let active=true;api('pdfs').then(list=>{if(active)setLibrary(list)}).catch(onError);return()=>{active=false}},[api,onError])
 async function transfer(current){
  const {Upload}=await import('tus-js-client')
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{void upload.current?.abort(false);reject(new Error('Transfert interrompu après trois minutes. Réessayez pour reprendre dans cet onglet.'))},180000)
   const options={endpoint:current.endpoint,headers:{apikey:current.publishableKey,'x-signature':current.signature},metadata:{bucketName:current.bucket,objectName:current.objectKey,contentType:'application/pdf',cacheControl:'0'},chunkSize:6*1024**2,uploadDataDuringCreation:true,storeFingerprintForResuming:false,removeFingerprintOnSuccess:true,retryDelays:[0,1000,3000,5000],onProgress:(sent,total)=>setProgress(Math.round(sent*100/total)),onSuccess:()=>{clearTimeout(timer);resolve()},onError:()=>{clearTimeout(timer);reject(new Error('Transfert PDF interrompu. Votre brouillon est conservé. Réessayez dans cet onglet.'))}}
   if(upload.current)Object.assign(upload.current.options,options);else upload.current=new Upload(file.current,options)
   upload.current.start()
  })
 }
 async function run(){
  setWorking(true);onBusy(true);setFailed(false);setLink(null)
  try{
   if(!file.current||file.current.size<1||file.current.size>20*1024**2||!file.current.name.toLowerCase().endsWith('.pdf'))throw new Error('Choisissez un PDF de 20 Mio maximum.')
   let ready
   if(intent.current){try{ready=await api('pdf-finish',{id:intent.current.id})}catch(e){if(![400,503].includes(e.status))throw e;if(e.status===400){intent.current=null;upload.current=null}}}
   if(!ready){
    if(!intent.current){setStatus('Autorisation du transfert…');intent.current=await api('pdf-begin',{name:file.current.name.slice(0,180),bytes:file.current.size})}
    setStatus('Transfert direct et reprenable vers le stockage privé…');await transfer(intent.current)
    setStatus('Validation des pages côté serveur…');ready=await api('pdf-finish',{id:intent.current.id})
   }
   onSelect(ready.id);setLibrary(await api('pdfs'));setStatus(`PDF validé : ${ready.pages} page(s), ${size(ready.bytes)}. Enregistrez le brouillon pour conserver ce choix.`)
  }catch(e){setFailed(true);setStatus(e.message);if([400,413,422].includes(e.status)){intent.current=null;upload.current=null}if(e.status===401||e.status===403)onError(e)}finally{setWorking(false);onBusy(false)}
 }
 async function view(id=value){setWorking(true);onBusy(true);try{setLink({...await api('pdf-link',{id,downloadName}),id})}catch(e){onError(e)}finally{setWorking(false);onBusy(false)}}
 async function remove(item){
  if(!window.confirm(`Supprimer définitivement « ${item.name} » ? Le fichier sera conservé si une version le référence.`))return
  setWorking(true);onBusy(true);try{await api('pdf-delete',{id:item.id,confirm:true});setLibrary(await api('pdfs'));if(item.id===value)onSelect(initial.id);if(link?.id===item.id)setLink(null);setStatus('PDF supprimé définitivement.')}catch(e){onError(e)}finally{setWorking(false);onBusy(false)}
 }
 async function cleanup(){if(!window.confirm('Nettoyer les transferts PDF temporaires expirés ? Les PDF validés et les versions conservées resteront présents.'))return;setWorking(true);onBusy(true);try{const r=await api('pdf-cleanup',{});setStatus(`${r.cleaned} transfert(s) expiré(s) nettoyé(s). Délai de sécurité : 27 heures.`)}catch(e){onError(e)}finally{setWorking(false);onBusy(false)}}
 const current=library.find(p=>p.id===value)||(initial?.id===value?initial:null)
 return <section className="admin-pdf"><h2>Portfolio PDF</h2><p>Le PDF publié reste disponible pendant l’édition. Chaque import crée un nouveau fichier privé.</p>
  <label>Importer un nouveau PDF<input type="file" accept="application/pdf,.pdf" disabled={working} onChange={e=>{if(!e.target.files[0])return;file.current=e.target.files[0];intent.current=null;upload.current=null;setProgress(0);void run();e.target.value=''}}/><small>20 Mio maximum · 100 pages maximum · PDF non chiffré, sans contenu actif ni formulaire.</small></label>
  {working&&<progress value={progress} max={100} aria-label="Transfert du PDF">{progress}%</progress>}{status&&<p role={failed?'alert':'status'}>{status}</p>}{failed&&<button type="button" disabled={working} onClick={run}>Réessayer le PDF</button>}
  <label>PDF du brouillon<select value={value||''} required onChange={e=>{onSelect(e.target.value);setLink(null)}}>{library.map(p=><option key={p.id} value={p.id} disabled={p.deleting}>{p.name} · {size(p.bytes)} · {p.pages??'?'} pages</option>)}</select></label>
  {current&&<div className="admin-pdf-current"><Icon name="file" width="32" height="32"/><div><strong>{downloadName}</strong><small>{size(current.bytes)} · {current.pages??'?'} pages</small></div><span className="admin-dev-badge">PDF validé · choix du brouillon</span></div>}
  <button type="button" disabled={working||!value} onClick={()=>view()}>Aperçu privé et téléchargement du PDF</button>
  {link&&<div className="admin-pdf-view"><p>Liens privés temporaires : 2 minutes. Actualisez l’accès si le lecteur cesse de répondre.</p><div className="admin-actions"><a href={link.previewUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Ouvrir le PDF dans un onglet</a><a href={link.downloadUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Télécharger — {downloadName}</a><button type="button" onClick={()=>view(link.id)} disabled={working}>Actualiser l’accès privé</button></div><iframe src={link.previewUrl} title="Aperçu privé du portfolio PDF" referrerPolicy="no-referrer"/></div>}
  <details><summary>PDF conservés et nettoyage</summary><p>Une ancienne version publiée reste restaurable. Sa référence empêche la suppression définitive du fichier.</p><button type="button" onClick={cleanup} disabled={working}>Nettoyer les transferts PDF expirés</button><ul className="admin-projects">{library.map(p=><li key={p.id}><strong>{p.name}</strong><span>{size(p.bytes)} · {p.pages??'?'} pages · {p.dependencies.siteReferences} référence(s) de profil</span><button type="button" onClick={()=>remove(p)} disabled={working}>{p.deleting?'Reprendre la suppression':'Supprimer définitivement ce PDF'}</button></li>)}</ul></details>
 </section>
}
