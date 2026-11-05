import {useCallback,useEffect,useRef,useState} from 'react'
import * as staticContent from './catalog'
import {ContentContext} from './content-context'
export function ContentProvider({children,initialContent}){
 const [state,setState]=useState(initialContent?{content:initialContent,static:true}:{loading:true}),inflight=useRef(null)
 const refresh=useCallback(async()=>{
  if(inflight.current)return inflight.current
  inflight.current=(async()=>{try{
   const r=await fetch('/api/content',{cache:'no-store',signal:AbortSignal.timeout(20000)}),body=await r.json()
   if(!r.ok)throw Error(body.error||'Le portfolio est momentanément indisponible.')
   if(body.source==='static')setState({content:staticContent,static:true})
   else if(body.source==='supabase-dev'||body.source==='supabase-prod')setState({content:body.content,version:body.version,source:body.source})
   else throw Error('Le portfolio est momentanément indisponible.')
  }catch(e){setState({error:e.name==='TimeoutError'?'Le chargement prend plus de temps que prévu. Réessayez.':'Le portfolio est momentanément indisponible. Réessayez.'})}finally{inflight.current=null}})()
  return inflight.current
 },[])
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},30000);const focus=()=>{if(document.visibilityState==='visible')void refresh()};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}},[refresh])
 if(!state.content)return <main id="main-content" className="shell section" aria-live="polite"><p className="eyebrow">Kevin Kilongo</p><h1>Portfolio</h1><p role={state.error?'alert':'status'}>{state.error||(state.loading?'Chargement du portfolio…':'Le portfolio est en cours de mise à jour.')}</p>{!state.loading&&<button className="button" onClick={refresh}>Réessayer</button>}</main>
 const content={...state.content,refresh,version:state.version,source:state.static?'static':state.source}
 return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
}
