'use client';
import {FormEvent,useEffect,useMemo,useState} from 'react';
import Nav from '@/components/Nav';
import {supabase} from '@/lib/supabase';

type Lead={id:string;nome:string|null;telefone:string|null;email:string|null;mensagem:string|null;status:string|null;origem:string|null};
const vazio={nome:'',telefone:'',email:'',mensagem:'',status:'novo',origem:'Manual'};

export default function ContatosPage(){
 const db=useMemo(()=>supabase(),[]);
 const[rows,setRows]=useState<Lead[]>([]),[busca,setBusca]=useState(''),[open,setOpen]=useState(false),[editId,setEditId]=useState<string|null>(null),[msg,setMsg]=useState(''),[f,setF]=useState(vazio);

 async function load(){const{data,error}=await db.from('leads').select('*').order('created_at',{ascending:false});if(error)setMsg('Não foi possível carregar: '+error.message);else setRows((data??[]) as Lead[])}
 useEffect(()=>{load()},[]);

 function novo(){setF(vazio);setEditId(null);setOpen(true)}
 function editar(x:Lead){setF({nome:x.nome??'',telefone:x.telefone??'',email:x.email??'',mensagem:x.mensagem??'',status:x.status??'novo',origem:x.origem??'Manual'});setEditId(x.id);setOpen(true)}

 async function salvar(e:FormEvent){e.preventDefault();const payload={nome:f.nome.trim(),telefone:f.telefone.trim(),email:f.email.trim()||null,mensagem:f.mensagem.trim()||null,status:f.status,origem:f.origem.trim()||'Manual'};const q=editId?db.from('leads').update(payload).eq('id',editId):db.from('leads').insert(payload);const{error}=await q;if(error)return setMsg('Não foi possível salvar: '+error.message);setOpen(false);setMsg(editId?'Contato atualizado.':'Contato cadastrado.');load()}

 async function excluir(x:Lead){if(!confirm(`Excluir o contato ${x.nome||x.telefone}?`))return;const{error}=await db.from('leads').delete().eq('id',x.id);if(error)return setMsg('Não foi possível excluir: '+error.message);setMsg('Contato excluído.');load()}

 const list=rows.filter(x=>[x.nome,x.telefone,x.email,x.status,x.origem].join(' ').toLowerCase().includes(busca.toLowerCase()));

 return <div className="shell"><Nav/><main className="content"><header><div><span className="eyebrow">GESTÃO NT ALPHA</span><h1>Contatos</h1><p className="page-intro">Leads e oportunidades recebidos pela NT ALPHA.</p></div><button onClick={novo}>+ Novo contato</button></header>
 {open&&<section className="panel form quick-form"><h2>{editId?'Editar contato':'Cadastro de contato'}</h2><form onSubmit={salvar}><div className="grid">
 <label>Nome *<input required value={f.nome} onChange={e=>setF({...f,nome:e.target.value})}/></label>
 <label>Telefone / WhatsApp *<input required value={f.telefone} onChange={e=>setF({...f,telefone:e.target.value})}/></label>
 <label>E-mail<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
 <label>Origem<input value={f.origem} onChange={e=>setF({...f,origem:e.target.value})} placeholder="Site, WhatsApp, indicação..."/></label>
 <label>Status<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="novo">Novo</option><option value="contatado">Contatado</option><option value="visita">Visita</option><option value="proposta">Proposta</option><option value="negociacao">Negociação</option><option value="concluido">Concluído</option><option value="perdido">Perdido</option></select></label>
 </div><label>Mensagem / Observações<textarea rows={4} value={f.mensagem} onChange={e=>setF({...f,mensagem:e.target.value})}/></label><div className="actions"><button>Salvar contato</button><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancelar</button></div></form></section>}
 {msg&&<div className="status">{msg}</div>}
 <section className="panel"><div className="toolbar"><input placeholder="Buscar por nome, telefone, status ou origem" value={busca} onChange={e=>setBusca(e.target.value)}/><div className="result-count">{list.length} contato(s)</div></div>
 {list.length===0?<div className="empty"><strong>Nenhum contato encontrado.</strong><span>Cadastre manualmente ou receba leads do site.</span></div>:<div className="data-list">{list.map(x=><article className="data-card crud-card" key={x.id}><div><strong>{x.nome||'Sem nome'}</strong><span>{x.telefone||'—'} · {x.email||'—'}</span></div><div><small>Status / Origem</small><b>{x.status||'novo'} · {x.origem||'—'}</b></div><div className="row-actions"><button onClick={()=>editar(x)}>Editar</button><button className="danger-button" onClick={()=>excluir(x)}>Excluir</button></div></article>)}</div>}</section>
 </main></div>
}