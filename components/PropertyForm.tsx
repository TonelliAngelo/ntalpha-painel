'use client';
import {FormEvent,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';

export default function PropertyForm(){
 const db=useMemo(()=>supabase(),[]),router=useRouter();
 const[f,setF]=useState({titulo:'',tipo:'Casa',cidade:'Barueri',bairro:'Alphaville',endereco:'',valor:'',area_util:'',dormitorios:'0',suites:'0',vagas:'0',status:'disponivel',descricao:'',destaque:false,publicar_site:false});
 const[msg,setMsg]=useState(''),[saving,setSaving]=useState(false);
 async function salvar(e:FormEvent){e.preventDefault();setSaving(true);setMsg('');
  const {data:{user}}=await db.auth.getUser();
  const {error}=await db.from('properties').insert({titulo:f.titulo.trim(),tipo:f.tipo,cidade:f.cidade.trim()||null,bairro:f.bairro.trim()||null,endereco:f.endereco.trim()||null,valor:f.valor?Number(f.valor):null,area_util:f.area_util?Number(f.area_util):null,dormitorios:Number(f.dormitorios)||0,suites:Number(f.suites)||0,vagas:Number(f.vagas)||0,status:f.status,descricao:f.descricao.trim()||null,destaque:f.destaque,publicar_site:f.publicar_site,created_by:user?.id??null,updated_by:user?.id??null});
  setSaving(false);if(error){setMsg('Não foi possível salvar: '+error.message);return}router.push('/imoveis');router.refresh()}
 return <form className="panel form" onSubmit={salvar}><div className="grid">
  <label>Título *<input required value={f.titulo} onChange={e=>setF({...f,titulo:e.target.value})} placeholder="Ex.: Casa contemporânea em Alphaville"/></label>
  <label>Tipo<select value={f.tipo} onChange={e=>setF({...f,tipo:e.target.value})}><option>Casa</option><option>Apartamento</option><option>Terreno</option></select></label>
  <label>Cidade<input value={f.cidade} onChange={e=>setF({...f,cidade:e.target.value})}/></label><label>Bairro / Região<input value={f.bairro} onChange={e=>setF({...f,bairro:e.target.value})}/></label>
  <label>Endereço<input value={f.endereco} onChange={e=>setF({...f,endereco:e.target.value})}/></label><label>Valor (R$)<input type="number" min="0" step="0.01" value={f.valor} onChange={e=>setF({...f,valor:e.target.value})}/></label>
  <label>Área útil (m²)<input type="number" min="0" step="0.01" value={f.area_util} onChange={e=>setF({...f,area_util:e.target.value})}/></label><label>Dormitórios<input type="number" min="0" value={f.dormitorios} onChange={e=>setF({...f,dormitorios:e.target.value})}/></label>
  <label>Suítes<input type="number" min="0" value={f.suites} onChange={e=>setF({...f,suites:e.target.value})}/></label><label>Vagas<input type="number" min="0" value={f.vagas} onChange={e=>setF({...f,vagas:e.target.value})}/></label>
  <label>Status<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option><option value="inativo">Inativo</option></select></label>
 </div><label>Descrição<textarea rows={6} value={f.descricao} onChange={e=>setF({...f,descricao:e.target.value})}/></label>
 <div className="checks"><label><input type="checkbox" checked={f.destaque} onChange={e=>setF({...f,destaque:e.target.checked})}/> Destaque</label><label><input type="checkbox" checked={f.publicar_site} onChange={e=>setF({...f,publicar_site:e.target.checked})}/> Publicar no site</label></div>
 <div className="upload"><b>Fotos do imóvel</b><p>Upload de fotos permanece para a etapa de Supabase Storage.</p><input type="file" multiple accept="image/*" disabled/></div>
 {msg&&<div className="status">{msg}</div>}<div className="actions"><button disabled={saving}>{saving?'Salvando...':'Salvar imóvel'}</button><a href="/imoveis">Cancelar</a></div></form>
}