'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;
function txt(row: Row, ...keys: string[]) {
  for (const key of keys) { const v=row[key]; if(v!==null&&v!==undefined&&String(v).trim()) return String(v); }
  return '—';
}
export default function ClientesPage() {
  const client=useMemo(()=>supabase(),[]); const [rows,setRows]=useState<Row[]>([]); const [loading,setLoading]=useState(true); const [erro,setErro]=useState(''); const [busca,setBusca]=useState('');
  useEffect(()=>{let active=true;(async()=>{const {data,error}=await client.from('clients').select('*').order('created_at',{ascending:false});if(!active)return;if(error)setErro('Não foi possível carregar os clientes.');else setRows((data??[]) as Row[]);setLoading(false)})();return()=>{active=false}},[client]);
  const filtrados=rows.filter(r=>[txt(r,'nome','name'),txt(r,'telefone','phone','whatsapp'),txt(r,'email')].join(' ').toLowerCase().includes(busca.toLowerCase()));
  return <div className="shell"><Nav/><main className="content"><header><div><span className="eyebrow">GESTÃO NT ALPHA</span><h1>Clientes</h1><p className="page-intro">Base de clientes e proprietários cadastrados.</p></div></header><section className="panel"><div className="toolbar"><input placeholder="Buscar por nome, telefone ou e-mail" value={busca} onChange={e=>setBusca(e.target.value)}/><div className="result-count">{filtrados.length} cliente(s)</div></div>{loading?<div className="empty"><strong>Carregando clientes...</strong></div>:erro?<div className="empty error"><strong>{erro}</strong></div>:filtrados.length===0?<div className="empty"><strong>Nenhum cliente encontrado.</strong><span>Os cadastros aparecerão aqui.</span></div>:<div className="data-list">{filtrados.map((r,i)=><article className="data-card" key={String(r.id??i)}><div><strong>{txt(r,'nome','name')}</strong><span>{txt(r,'email')}</span></div><div><small>Telefone / WhatsApp</small><b>{txt(r,'telefone','phone','whatsapp')}</b></div><div><small>CPF</small><b>{txt(r,'cpf')}</b></div></article>)}</div>}</section></main></div>;
}