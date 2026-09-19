'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type Row=Record<string,unknown>;
function txt(row:Row,...keys:string[]){for(const key of keys){const v=row[key];if(v!==null&&v!==undefined&&String(v).trim())return String(v)}return '—'}
export default function ContatosPage(){
 const client=useMemo(()=>supabase(),[]);const [rows,setRows]=useState<Row[]>([]);const [loading,setLoading]=useState(true);const [erro,setErro]=useState('');const [busca,setBusca]=useState('');
 useEffect(()=>{let active=true;(async()=>{const {data,error}=await client.from('leads').select('*').order('created_at',{ascending:false});if(!active)return;if(error)setErro('Não foi possível carregar os contatos.');else setRows((data??[]) as Row[]);setLoading(false)})();return()=>{active=false}},[client]);
 const filtrados=rows.filter(r=>[txt(r,'nome','name'),txt(r,'telefone','phone','whatsapp'),txt(r,'status')].join(' ').toLowerCase().includes(busca.toLowerCase()));
 return <div className="shell"><Nav/><main className="content"><header><div><span className="eyebrow">GESTÃO NT ALPHA</span><h1>Contatos</h1><p className="page-intro">Leads e oportunidades recebidos pela NT ALPHA.</p></div></header><section className="panel"><div className="toolbar"><input placeholder="Buscar por nome, telefone ou status" value={busca} onChange={e=>setBusca(e.target.value)}/><div className="result-count">{filtrados.length} contato(s)</div></div>{loading?<div className="empty"><strong>Carregando contatos...</strong></div>:erro?<div className="empty error"><strong>{erro}</strong></div>:filtrados.length===0?<div className="empty"><strong>Nenhum contato encontrado.</strong><span>Os leads recebidos aparecerão aqui.</span></div>:<div className="data-list">{filtrados.map((r,i)=><article className="data-card" key={String(r.id??i)}><div><strong>{txt(r,'nome','name')}</strong><span>{txt(r,'telefone','phone','whatsapp')}</span></div><div><small>Status</small><b>{txt(r,'status')}</b></div><div><small>Mensagem</small><b>{txt(r,'mensagem','message')}</b></div></article>)}</div>}</section></main></div>;
}