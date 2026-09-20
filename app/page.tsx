'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type Property = {
  id:string;
  codigo:string;
  titulo:string;
  tipo:string|null;
  bairro:string|null;
  cidade:string|null;
  valor:number|null;
  status:string|null;
  publicar_site:boolean|null;
  destaque:boolean|null;
  created_at:string|null;
};

type Lead = {
  id:string;
  nome:string;
  telefone:string|null;
  origem:string|null;
  status:string|null;
  created_at:string|null;
};

function dinheiro(v:number|null){
  if(v==null) return '—';
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
}

export default function Dashboard(){
  const db=useMemo(()=>supabase(),[]);
  const [loading,setLoading]=useState(true);
  const [erro,setErro]=useState('');
  const [properties,setProperties]=useState<Property[]>([]);
  const [clients,setClients]=useState(0);
  const [condos,setCondos]=useState(0);
  const [leads,setLeads]=useState<Lead[]>([]);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      setErro('');

      const [p,c,co,l]=await Promise.all([
        db.from('properties')
          .select('id,codigo,titulo,tipo,bairro,cidade,valor,status,publicar_site,destaque,created_at')
          .order('created_at',{ascending:false}),
        db.from('clients').select('id',{count:'exact',head:true}),
        db.from('condominiums').select('id',{count:'exact',head:true}),
        db.from('leads').select('id,nome,telefone,origem,status,created_at')
          .order('created_at',{ascending:false}).limit(5)
      ]);

      const firstError=p.error||c.error||co.error||l.error;
      if(firstError){
        setErro('Não foi possível carregar todos os indicadores do dashboard.');
      }

      setProperties((p.data??[]) as Property[]);
      setClients(c.count??0);
      setCondos(co.count??0);
      setLeads((l.data??[]) as Lead[]);
      setLoading(false);
    }
    load();
  },[db]);

  const total=properties.length;
  const disponiveis=properties.filter(p=>p.status==='disponivel').length;
  const publicados=properties.filter(p=>p.publicar_site===true && p.status==='disponivel').length;
  const destaques=properties.filter(p=>p.destaque===true && p.publicar_site===true && p.status==='disponivel').length;
  const indisponiveis=properties.filter(p=>p.status!=='disponivel').length;
  const valorCarteira=properties
    .filter(p=>p.status==='disponivel')
    .reduce((s,p)=>s+(Number(p.valor)||0),0);

  const cards=[
    ['Imóveis cadastrados',total],
    ['Disponíveis',disponiveis],
    ['Publicados no site',publicados],
    ['Destaques',destaques],
    ['Clientes',clients],
    ['Condomínios',condos],
    ['Contatos',leads.length],
    ['Vendidos / inativos',indisponiveis],
  ];

  return <div className="shell">
    <Nav/>
    <main className="content">
      <header>
        <div>
          <span className="eyebrow">GESTÃO NT ALPHA</span>
          <h1>Dashboard</h1>
          <p className="page-intro">Visão geral da operação imobiliária.</p>
        </div>
        <a className="button" href="/imoveis/novo">+ Novo imóvel</a>
      </header>

      {erro&&<div className="status">{erro}</div>}

      <section className="cards">
        {cards.map(([label,value])=>
          <article className="stat" key={String(label)}>
            <span>{label}</span>
            <strong>{loading?'—':value}</strong>
          </article>
        )}
      </section>

      <section className="panel" style={{marginTop:20}}>
        <span className="eyebrow">CARTEIRA ATUAL</span>
        <h2 style={{marginBottom:6}}>Valor dos imóveis disponíveis</h2>
        <div style={{fontSize:'32px',fontWeight:800,color:'#075b47',marginBottom:8}}>
          {loading?'—':dinheiro(valorCarteira)}
        </div>
        <p className="page-intro" style={{margin:0}}>
          Soma dos valores cadastrados dos imóveis com status disponível.
        </p>
      </section>

      <section className="panel" style={{marginTop:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div>
            <span className="eyebrow">IMÓVEIS</span>
            <h2 style={{marginBottom:4}}>Cadastros mais recentes</h2>
          </div>
          <a className="secondary-button" href="/imoveis">Ver todos</a>
        </div>

        {loading?<div className="empty"><strong>Carregando...</strong></div>:
        properties.length===0?<div className="empty"><strong>Nenhum imóvel cadastrado.</strong></div>:
        <div className="data-list" style={{marginTop:14}}>
          {properties.slice(0,5).map(p=>
            <article className="data-card crud-card" key={p.id}>
              <div>
                <strong>{p.codigo} — {p.titulo}</strong>
                <span>{[p.tipo,p.bairro,p.cidade].filter(Boolean).join(' · ')}</span>
              </div>
              <div><small>Valor</small><b>{dinheiro(p.valor)}</b></div>
              <div><small>Status</small><b>{p.status||'—'}</b></div>
              <div><small>Site</small><b>{p.publicar_site?'Publicado':'Não publicado'}</b></div>
            </article>
          )}
        </div>}
      </section>

      <section className="panel" style={{marginTop:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div>
            <span className="eyebrow">COMERCIAL</span>
            <h2 style={{marginBottom:4}}>Contatos recentes</h2>
          </div>
          <a className="secondary-button" href="/contatos">Abrir contatos</a>
        </div>

        {loading?<div className="empty"><strong>Carregando...</strong></div>:
        leads.length===0?
          <div className="empty" style={{marginTop:14}}>
            <strong>Nenhum contato recebido ainda.</strong>
            <p>Os contatos enviados pelo site aparecerão aqui automaticamente.</p>
          </div>:
          <div className="data-list" style={{marginTop:14}}>
            {leads.map(l=>
              <article className="data-card crud-card" key={l.id}>
                <div><strong>{l.nome}</strong><span>{l.telefone||'—'}</span></div>
                <div><small>Origem</small><b>{l.origem||'—'}</b></div>
                <div><small>Status</small><b>{l.status||'—'}</b></div>
              </article>
            )}
          </div>}
      </section>
    </main>
  </div>;
}
