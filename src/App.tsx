import React, { useEffect, useMemo, useState } from 'react'
import { format, parseISO, addMinutes } from 'date-fns'
import Navbar from './Navbar' // barre de navigation responsive

type Statut = 'a_confirmer'|'confirme'|'annule'
type EventItem = {
  id: string
  titre: string
  client: string
  telephone: string
  typeLieu: string
  adresse: string
  immatriculation?: string
  date: string
  heureDebut: string
  heureFin: string
  service: string
  prixHT: string
  assureur: string
  numSinistre: string
  statut: Statut
  notes: string
  technicienId: string
}

const serviceDurations: Record<string, number> = {
  'Remplacement pare-brise': 90,
  'Réparation impact': 45,
  'Remplacement vitre latérale': 75,
  'Remplacement lunette arrière': 90,
}

function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function useLocalStorage<T>(key: string, initial: T){
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) as T : initial
    } catch { return initial }
  })
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(state)) }catch{} }, [key, state])
  return [state, setState] as const
}

function defaultEvent(): EventItem {
  const d = new Date()
  return {
    id: uid(),
    titre: '',
    client: '',
    telephone: '',
    typeLieu: 'domicile',
    adresse: '',
    immatriculation: '',
    date: format(d, 'yyyy-MM-dd'),
    heureDebut: '09:00',
    heureFin: '',
    service: 'Remplacement pare-brise',
    prixHT: '200',
    assureur: '',
    numSinistre: '',
    statut: 'a_confirmer',
    notes: '',
    technicienId: 't1',
  }
}

export default function App(){
  const [events, setEvents] = useLocalStorage<EventItem[]>('pg-events', [])
  const [form, setForm] = useState<EventItem>(defaultEvent())
  const [editing, setEditing] = useState<string|null>(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState<'tous'|Statut>('tous')
  const [techs] = useLocalStorage('pg-techs', [
    { id: 't1', nom: 'Véhicule 1 (bleu)' },
    { id: 't2', nom: 'Véhicule 2 (vert)' },
  ])
  const [tab, setTab] = useState<'annee'|'jour'|'liste'>('annee')
  const [year, setYear] = useState(new Date().getFullYear())
  const [q, setQ] = useState('')

  const filtered = useMemo(()=>{
    return events.filter(ev=>{
      const okDate = !filterDate || ev.date === filterDate
      const okStat = filterStatut === 'tous' || ev.statut === filterStatut
      const hay = (ev.titre+ev.client+ev.telephone+ev.adresse+ev.assureur+ev.numSinistre+ev.service).toLowerCase()
      const okQ = !q || hay.includes(q.toLowerCase())
      return okDate && okStat && okQ
    }).sort((a,b)=>(a.date+a.heureDebut).localeCompare(b.date+b.heureDebut))
  }, [events, filterDate, filterStatut, q])

  function reset(){ setForm(defaultEvent()); setEditing(null) }

  function save(){
    if(!form.client || !form.date) { alert('Client et date obligatoires'); return }
    let fin = form.heureFin
    const dur = serviceDurations[form.service] || 60
    if(!fin){
      const dt = addMinutes(parseISO(form.date+'T'+form.heureDebut+':00'), dur)
      fin = format(dt, 'HH:mm')
    }
    const start = form.heureDebut.replace(':','')
    const end = (fin as string).replace(':','')
    const overlap = events.some(e =>
      e.date===form.date && (e.technicienId||'t1')===(form.technicienId||'t1') &&
      !(end <= e.heureDebut.replace(':','') || start >= e.heureFin.replace(':','')) &&
      (!editing || e.id !== editing)
    )
    if(overlap){ alert('Conflit: RDV déjà existant sur ce créneau pour ce véhicule.'); return }
    const ev = { ...form, heureFin: fin as string }
    setEvents(prev => editing ? prev.map(p=> p.id===editing ? { ...ev, id: editing } : p) : [...prev, ev])
    reset()
  }

  function edit(ev: EventItem){ setEditing(ev.id); setForm(ev); window.scrollTo({top:0,behavior:'smooth'}) }
  function del(id: string){ setEvents(prev=> prev.filter(e=>e.id!==id)); if(editing===id) reset() }

  function moveEvent(id: string, newTechId: string, minutesFromStart: number){
    setEvents(prev => prev.map(e=>{
      if(e.id!==id) return e
      const DAY_START=8*60, DAY_END=18*60
      const round = (v:number)=> Math.max(0, Math.round(v/15)*15)
      const [h0,m0]=e.heureDebut.split(':').map(Number)
      const [h1,m1]=e.heureFin.split(':').map(Number)
      const dur=Math.max(15,(h1*60+m1)-(h0*60+m0))
      let startMin = DAY_START + round(minutesFromStart)
      startMin = Math.min(Math.max(DAY_START,startMin), DAY_END-dur)
      const toHM=(min:number)=> String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0')
      return { ...e, technicienId:newTechId, heureDebut: toHM(startMin), heureFin: toHM(startMin+dur) }
    }))
  }

  const grouped = groupByDate(filtered)
  const dates = Object.keys(grouped).sort()

  return (
    <>
      {/* ======= NAVBAR (nouvelle) ======= */}
      <Navbar />

      {/* ======= HEADER AGENDA (logo PNG) ======= */}
      <header id="planning" className="toolbar">
        <div className="logo">
          {/* Assure-toi d’avoir public/logo.png */}
          <img src="/logo.png" alt="ProxiGlass" style={{ height: 50 }} />
          <span className="brand">Planning RDV</span>
        </div>

        <div id="export" className="row">
          <button className="btn" onClick={()=>seedTests(setEvents)}>Données de test</button>
          <button className="btn" onClick={()=>{localStorage.removeItem('pg-events'); setEvents([])}}>Réinitialiser</button>
          <button className="btn" onClick={()=>exportCSV(events)}>Exporter CSV</button>
        </div>
      </header>

      <div className="container">
        {/* Filtres + Année */}
        <div className="card">
          <div className="row">
            <div style={{minWidth:180}}>
              <label>Année</label>
              <input type="number" value={year} onChange={e=>setYear(Number(e.target.value)||year)} />
            </div>
            <div style={{minWidth:180}}>
              <label>Date</label>
              <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} />
            </div>
            <div style={{minWidth:180}}>
              <label>Statut</label>
              <select value={filterStatut} onChange={e=>setFilterStatut(e.target.value as any)}>
                <option value="tous">Tous</option>
                <option value="a_confirmer">À confirmer</option>
                <option value="confirme">Confirmé</option>
                <option value="annule">Annulé</option>
              </select>
            </div>
            <div style={{flex:1,minWidth:240}}>
              <label>Recherche</label>
              <input placeholder="Client, tel, adresse, assureur…" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Formulaire RDV */}
        <div className="card">
          <div className="row" style={{alignItems:'center', justifyContent:'space-between'}}>
            <h3>{editing ? 'Modifier un rendez-vous' : 'Nouveau rendez-vous'}</h3>
            <div className="row">
              {editing && <button className="btn" onClick={reset}>Annuler</button>}
              <button className="btn primary" onClick={save}>{editing ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
          </div>

          {/* 4 colonnes desktop -> 2 (<=1024px) -> 1 (<=768px) géré par CSS */}
          <div className="grid" style={{gridTemplateColumns:'repeat(4, minmax(200px,1fr))'}}>
            <div><label>Titre</label><input value={form.titre} onChange={e=>setForm({...form, titre:e.target.value})} placeholder="Remplacement pare-brise Opel Corsa"/></div>
            <div><label>Service</label>
              <select value={form.service} onChange={e=>setForm({...form, service:e.target.value, heureFin:''})}>
                {Object.keys(serviceDurations).map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label>Client</label><input value={form.client} onChange={e=>setForm({...form, client:e.target.value})}/></div>
            <div><label>Téléphone</label><input value={form.telephone} onChange={e=>setForm({...form, telephone:e.target.value})}/></div>
            <div><label>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/></div>
            <div><label>Heure début</label><input type="time" value={form.heureDebut} onChange={e=>setForm({...form, heureDebut:e.target.value, heureFin:''})}/></div>
            <div><label>Heure fin</label><input type="time" value={form.heureFin} onChange={e=>setForm({...form, heureFin:e.target.value})} placeholder="Auto selon service"/></div>
            <div><label>Véhicule / Technicien</label>
              <select value={form.technicienId} onChange={e=>setForm({...form, technicienId:e.target.value})}>
                <option value="t1">Véhicule 1</option>
                <option value="t2">Véhicule 2</option>
              </select>
            </div>
            <div><label>Type de lieu</label>
              <select value={form.typeLieu} onChange={e=>setForm({...form, typeLieu:e.target.value})}>
                <option value="domicile">Domicile</option>
                <option value="travail">Travail</option>
                <option value="atelier">Atelier</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div><label>Adresse</label><input value={form.adresse} onChange={e=>setForm({...form, adresse:e.target.value})} placeholder="Adresse d'intervention"/></div>
            <div><label>Plaque d'immatriculation</label><input value={form.immatriculation||''} onChange={e=>setForm({...form, immatriculation:e.target.value.toUpperCase()})} placeholder="AA-123-BB"/></div>
            <div><label>Assureur</label><input value={form.assureur} onChange={e=>setForm({...form, assureur:e.target.value})}/></div>
            <div><label>N° sinistre</label><input value={form.numSinistre} onChange={e=>setForm({...form, numSinistre:e.target.value})}/></div>
            <div><label>Prix HT (€)</label><input type="number" value={form.prixHT} onChange={e=>setForm({...form, prixHT:e.target.value})}/></div>
            <div><label>Statut</label>
              <select value={form.statut} onChange={e=>setForm({...form, statut:e.target.value as Statut})}>
                <option value="a_confirmer">À confirmer</option>
                <option value="confirme">Confirmé</option>
                <option value="annule">Annulé</option>
              </select>
            </div>
            <div style={{gridColumn:'1 / -1'}}><label>Notes</label><textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={3}/></div>
          </div>
        </div>

        {/* Onglets */}
        <div className="tabs">
          <button className={'tab '+(tab==='annee'?'active':'')} onClick={()=>setTab('annee')}>Année</button>
          <button className={'tab '+(tab==='jour'?'active':'')} onClick={()=>setTab('jour')}>Jour</button>
          <button className={'tab '+(tab==='liste'?'active':'')} onClick={()=>setTab('liste')}>Liste</button>
        </div>

        {tab==='annee' && <YearView year={year} events={events} onPickDay={(d)=>{ setFilterDate(d); setTab('jour') }} />}
        {tab==='jour' && <DayView events={filtered} date={filterDate || format(new Date(), 'yyyy-MM-dd')} onEdit={edit} onDel={del} onMove={moveEvent} />}
        {tab==='liste' && <ListView grouped={grouped} techs={techs} onEdit={edit} onDel={del} />}

        {/* Ancre "Aide" pour la Navbar */}
        <div id="aide" style={{marginTop:24}} />
      </div>
    </>
  )
}

function groupByDate(evs: EventItem[]){
  return evs.reduce((acc: Record<string, EventItem[]>, ev) => { (acc[ev.date] ||= []).push(ev); return acc }, {})
}

/* ===== Helpers CSV / ICS ===== */
function csvEscape(v: any) {
  const s = String(v ?? '');
  const needsQuotes = s.includes(',') || s.includes('\n') || s.includes('"');
  const doubled = s.split('"').join('""');
  return needsQuotes ? `"${doubled}"` : s.
}

function exportCSV(events: EventItem[]) {
  const headers = [
    'ID','Date','Heure début','Heure fin','Titre','Service','Client','Téléphone',
    'Type lieu','Adresse','Immatriculation','Assureur','N° sinistre','Statut','Prix HT',
    'Technicien','Notes'
  ];
  const rows = events.map(ev => [
    ev.id, ev.date, ev.heureDebut, ev.heureFin, ev.titre, ev.service, ev.client,
    ev.telephone, ev.typeLieu, ev.adresse, ev.immatriculation || '', ev.assureur,
    ev.numSinistre, ev.statut, ev.prixHT, ev.technicienId, ev.notes
  ]);
  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proxiglass-planning-${format(new Date(),'yyyyMMdd-HHmm')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toICS(ev: EventItem) {
  const dtStart = ev.date + 'T' + ev.heureDebut.replace(':', '') + '00';
  const dtEnd   = ev.date + 'T' + ev.heureFin.replace(':', '') + '00';
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ProxiGlass//Planning//FR',
    'BEGIN:VEVENT',
    'UID:' + ev.id,
    'DTSTAMP:' + format(new Date(),'yyyyMMdd\'T\'HHmmss'),
    'DTSTART:' + dtStart,
    'DTEND:' + dtEnd,
    'SUMMARY:' + (ev.titre || ev.service) + ' – ' + ev.client,
    'LOCATION:' + ev.typeLieu.toUpperCase() + ' ' + ev.adresse,
    'DESCRIPTION:' +
      'Service: ' + ev.service + '\\n' +
      'Client: ' + ev.client + '\\n' +
      'Tél: ' + (ev.telephone || '') + '\\n' +
      'Immatriculation: ' + (ev.immatriculation || '') + '\\n' +
      'Assureur: ' + (ev.assureur || '') + '\\n' +
      'Sinistre: ' + (ev.numSinistre || '') + '\\n' +
      'Notes: ' + (ev.notes || ''),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([lines], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rdv-${ev.client}-${ev.date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
/* ===== Fin helpers ===== */

function YearView({ year, events, onPickDay }:{year:number, events:EventItem[], onPickDay:(iso:string)=>void}){
  const byDate: Record<string, number> = {}
  const byMonth: Record<string, {count:number, ca:number}> = {}
  for(const ev of events){
    const y = Number(ev.date.slice(0,4)); if(y!==year) continue
    byDate[ev.date] = (byDate[ev.date]||0)+1
    const m = ev.date.slice(0,7); byMonth[m] = byMonth[m]||{count:0, ca:0}
    byMonth[m].count++; byMonth[m].ca += Number(ev.prixHT||0)
  }
  const months = Array.from({length:12}, (_,i)=>i)
  const firstDow = (y:number,m:number)=> (new Date(y,m,1).getDay()+6)%7
  const daysIn = (y:number,m:number)=> new Date(y,m+1,0).getDate()

  return (
    <div className="card">
      <h3>Calendrier annuel {year}</h3>
      <div className="row">
        {months.map(m=>{
          const dmax = daysIn(year,m)
          const pad = firstDow(year,m)
          const key = `${year}-${String(m+1).padStart(2,'0')}`
          const meta = byMonth[key]||{count:0, ca:0}
          return (
            <div key={m} className="card" style={{width: 'calc(25% - 12px)'}}>
              <div style={{fontWeight:700, marginBottom:8}}>{new Date(year,m,1).toLocaleString('fr-FR',{month:'long'})}</div>
              <div className="grid" style={{gridTemplateColumns:'repeat(7,1fr)'}}>
                {['L','M','M','J','V','S','D'].map((d,i)=><div key={'h'+i} style={{textAlign:'center',fontSize:12,color:'#64748b'}}>{d}</div>)}
                {Array.from({length:pad}).map((_,i)=><div key={'pad'+i} style={{height:24}} />)}
                {Array.from({length:dmax}).map((_,i)=>{
                  const d=i+1; const iso = `${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const count = byDate[iso]||0
                  return <button key={iso} onClick={()=>onPickDay(iso)} style={{height:28,border:'1px solid #e5e7eb',background:count?'#e0f2fe':'#f1f5f9',borderRadius:6,fontSize:12,cursor:'pointer'}}>{d}{count?` (${count})`:''}</button>
                })}
              </div>
              <div style={{marginTop:6,fontSize:12,color:'#475569'}}>Mois: <b>{meta.count}</b> RDV • CA <b>{meta.ca.toFixed(2)} €</b></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayView({ events, date, onEdit, onDel, onMove }:{ events:EventItem[], date:string, onEdit:(e:EventItem)=>void, onDel:(id:string)=>void, onMove:(id:string,techId:string,min:number)=>void }){
  const DAY_START = 8*60, DAY_END = 18*60, PX_PER_MIN = 2/3
  const parseHM = (hm:string)=>{ const [h,m]=hm.split(':').map(Number); return h*60+m }
  const durMin = (from:string,to:string)=> parseHM(to)-parseHM(from)
  const techs = ['t1','t2']
  const labels: Record<string,string> = { t1:'Véhicule 1', t2:'Véhicule 2', _na:'Non attribué'}
  const columns = [...techs, '_na']
  const byTech: Record<string, EventItem[]> = { t1:[], t2:[], _na:[] }
  events.filter(e=>e.date===date).forEach(e=> (byTech[e.technicienId || '_na']||byTech['_na']).push(e) )
  Object.values(byTech).forEach(list=> list.sort((a,b)=> a.heureDebut.localeCompare(b.heureDebut)))
  const totalHeight = (DAY_END-DAY_START)*PX_PER_MIN
  const hours = Array.from({length: (DAY_END-DAY_START)/60 + 1}, (_,i)=> 8+i)

  return (
    <div className="card">
      <h3>Planning du {new Date(date+'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long',day:'2-digit',month:'short',year:'numeric'})}</h3>
      <div className="day-grid" style={{'--cols': String(columns.length)} as React.CSSProperties}>
        <div className="col">
          <div className="col-head">Heures</div>
          <div style={{position:'relative', height: totalHeight}}>
            {hours.map((h,i)=>{
              const top = (i*60)*PX_PER_MIN
              return <div className="hour" key={h} style={{top}}><label>{String(h).padStart(2,'0')}:00</label></div>
            })}
          </div>
        </div>
        {columns.map(col => (
          <div key={col} className="col">
            <div className="col-head">{labels[col]}</div>
            <div style={{position:'relative', height: totalHeight}}
                 onDragOver={e=>e.preventDefault()}
                 onDrop={(e)=>{
                   e.preventDefault()
                   const data = e.dataTransfer.getData('text/plain'); if(!data) return
                   const { id, offsetY } = JSON.parse(data)
                   const top = (e.currentTarget as HTMLElement).getBoundingClientRect().top
                   const y = e.clientY - top - (offsetY||0)
                   const minutesFromStart = Math.max(0, y / PX_PER_MIN)
                   onMove(id, col, minutesFromStart)
                 }}>
              {hours.map((h,i)=>{
                const top = (i*60)*PX_PER_MIN
                return <div key={h} style={{position:'absolute',left:0,right:0,top, borderTop:'1px dashed #e5e7eb'}} />
              })}
              {(byTech[col]||[]).map(ev => {
                const top = (parseHM(ev.heureDebut)-DAY_START)*PX_PER_MIN
                const height = Math.max(28, durMin(ev.heureDebut, ev.heureFin)*PX_PER_MIN - 4)
                return (
                  <div key={ev.id} className="card-evt" style={{top, height}}>
                    <div draggable className="handle" title="Glisser pour déplacer"
                      onDragStart={(e)=>{
                        const card = (e.currentTarget as HTMLElement).parentElement!
                        const offsetY = e.clientY - card.getBoundingClientRect().top
                        e.dataTransfer.setData('text/plain', JSON.stringify({ id: ev.id, offsetY }))
                      }}/>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:2}}>
                      <b>{ev.heureDebut} – {ev.heureFin}</b>
                      <span className="badge">{ev.service}</span>
                    </div>
                    <div style={{fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {(ev.titre||ev.service)} – <b>{ev.client}</b>
                    </div>
                    <div style={{fontSize:12,color:'#475569',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {ev.typeLieu} • {ev.adresse || '—'}{ev.immatriculation ? ' • '+ev.immatriculation : ''}
                    </div>
                    <div style={{display:'flex',gap:6,justifyContent:'flex-end',marginTop:4}}>
                      <button className="btn" onClick={()=>toICS(ev)}>Exporter .ics</button>
                      <button className="btn" onClick={()=>onEdit(ev)}>Éditer</button>
                      <button className="btn danger" onClick={()=>onDel(ev.id)}>Supprimer</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListView({ grouped, techs, onEdit, onDel }:{ grouped:Record<string,EventItem[]>, techs:any[], onEdit:(e:EventItem)=>void, onDel:(id:string)=>void }){
  const dates = Object.keys(grouped).sort()
  if(dates.length===0) return <div className="card">Aucun rendez-vous.</div>
  return (
    <div className="card">
      <h3>Liste des rendez-vous</h3>
      <div className="list-row list-head">
        <div>Date</div><div>Client</div><div>Heure</div><div>Service</div><div>Véhicule</div><div>Actions</div>
      </div>
      {dates.map(d => grouped[d].map(ev => (
        <div key={ev.id} className="list-row">
          <div>{new Date(d+'T00:00:00').toLocaleDateString('fr-FR')}</div>
          <div><b>{ev.client}</b><div style={{fontSize:12,color:'#475569'}}>{ev.titre||ev.service}</div></div>
          <div>{ev.heureDebut}–{ev.heureFin}</div>
          <div>{ev.service}</div>
          <div>{ev.technicienId==='t2'?'Véhicule 2':'Véhicule 1'}</div>
          <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
            <button className="btn" onClick={()=>toICS(ev)}>Export .ics</button>
            <button className="btn" onClick={()=>onEdit(ev)}>Éditer</button>
            <button className="btn danger" onClick={()=>onDel(ev.id)}>Supprimer</button>
          </div>
        </div>
      )))}
    </div>
  )
}

function seedTests(setEvents:(fn:(prev:EventItem[])=>EventItem[])=>void){
  const ym = format(new Date(),'yyyy-MM')
  const sample: Partial<EventItem>[] = [
    { date: `${ym}-10`, heureDebut: '09:00', client: 'Mme Martin', service: 'Remplacement pare-brise', typeLieu: 'domicile', prixHT: '420', statut: 'confirme', technicienId: 't1', immatriculation:'AA-123-BB' },
    { date: `${ym}-10`, heureDebut: '10:30', client: 'Garage Pro B2B', service: 'Réparation impact', typeLieu: 'travail', prixHT: '90', statut: 'a_confirmer', technicienId: 't1', immatriculation:'CC-456-DD' },
    { date: `${ym}-18`, heureDebut: '14:00', client: 'Mr Leroy', service: 'Remplacement vitre latérale', typeLieu: 'domicile', prixHT: '260', statut: 'confirme', technicienId: 't2', immatriculation:'EE-789-FF' },
  ]
  const evs = sample.map(s=>{
    const e = { ...defaultEvent(), ...s } as EventItem
    const dur = serviceDurations[e.service] || 60
    const dt = addMinutes(parseISO(e.date+'T'+e.heureDebut+':00'), dur)
    e.heureFin = format(dt,'HH:mm'); e.id = uid()
    return e
  })
  setEvents(prev=> [...prev, ...evs])
}
