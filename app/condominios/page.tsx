'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type Row=Record<string,unknown>;
function txt(row:Row,...keys:string[]){for(const key of keys){const v=row[key];if(v!==null&&v!==undefined&&String(v).trim())return String(v)}return '—'}
export default function CondominiosPage(){
 const client=useMemo(()=>supabase(),[]);const [rows,setRows]=useState<Row[]>([]);const [loading,setLoading]=useState(true);const [erro,setErro]=useState('');const [busca,setBusca]=useState('');
 useEffect(()=>{let active=true;(async()=>{const {data,error}=await client.from('condominiums').select('*').order('created_at',{ascending:false});if(!active)return;if(error)setErro('Não foi possível carregar os condomínios.');else setRows((data??[]) as Row[]);setLoading(false)})();return()=>{active=false}},[client]);
 const filtrados=rows.filter(r=>[txt(r,'nome','name'),txt(r,'cidade','city'),txt(r,'bairro','neighborhood')].join(' ').toLowerCase().includes(busca.toLowerCase()));
 return <div className="shell"><Nav/><main className="content"><header><div><span className="eyebrow">GESTÃO NT ALPHA</span><h1>Condomínios</h1><p className="page-intro">Referência dos condomínios atendidos pela NT ALPHA.</p></div></header><section className="panel"><div className="toolbar"><input placeholder="Buscar por nome, cidade ou bairro" value={busca} onChange={e=>setBusca(e.target.value)}/><div className="result-count">{filtrados.length} condomínio(s)</div></div>{loading?<div className="empty"><strong>Carregando condomínios...</strong></div>:erro?<div className="empty error"><strong>{erro}</strong></div>:filtrados.length===0?<div className="empty"><strong>Nenhum condomínio encontrado.</strong><span>Os cadastros aparecerão aqui.</span></div>:<div className="data-list">{filtrados.map((r,i)=><article className="data-card" key={String(r.id??i)}><div><strong>{txt(r,'nome','name')}</strong><span>{txt(r,'bairro','neighborhood')}</span></div><div><small>Cidade</small><b>{txt(r,'cidade','city')}</b></div><div><small>Endereço</small><b>{txt(r,'endereco','address')}</b></div></article>)}</div>}</section></main></div>;
}