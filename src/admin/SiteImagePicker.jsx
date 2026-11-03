import { useState } from 'react'
import ProjectImages from './ProjectImages'
export default function SiteImagePicker({ label, value, alt, credit, choices, onChange, onImported, onDeleted, onBusy, onError, api, optional = false }) {
  const [open,setOpen]=useState(false)
  const choose=image=>{onImported(image);onChange({id:image.id,alt:image.defaults?.alt||alt||'',credit:image.defaults?.credit??null})}
  return <div className="admin-site-image"><h3>{label}</h3>{value&&<img src={`/api/admin?action=media&id=${value}`} alt={alt||''} loading="lazy" decoding="async" />}
    <label>Image choisie<select value={value||''} required={!optional} onChange={e=>{const found=choices.find(i=>i.id===e.target.value);if(found)choose(found);else onChange({id:null,alt:'',credit:null})}}><option value="">{optional?'Sans image':'Choisir une image…'}</option>{choices.map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
    <label>Texte alternatif<input value={alt||''} required={!!value} maxLength={1000} onChange={e=>onChange({id:value,alt:e.target.value,credit})}/></label>
    <label>Crédit de l’image<input value={credit||''} maxLength={2000} onChange={e=>onChange({id:value,alt,credit:e.target.value})}/></label>
    <button type="button" onClick={()=>setOpen(v=>!v)}>{open?'Fermer l’import':'Importer une nouvelle image'}</button>
    {open&&<ProjectImages images={value?[{id:value}]:[]} single api={api} onAdd={choose} onRemove={onDeleted} onBusy={onBusy} onError={onError}/>}
  </div>
}
