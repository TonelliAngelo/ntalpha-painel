'use client';

import {ChangeEvent,FormEvent,useEffect,useMemo,useState} from 'react';
import Nav from '@/components/Nav';
import {supabase} from '@/lib/supabase';

const BUCKET='property-images', MAX_PHOTOS=10;
type P={id:string;codigo:string|null;titulo:string;tipo:string;cidade:string|null;bairro:string|null;endereco:string|null;valor:number|null;dormitorios:number;suites:number;vagas:number;area_util:number|null;descricao:string|null;status:string;destaque:boolean;publicar_site:boolean};
type Client={id:string;nome:string|null;telefone:string|null};
type Media={id:string;property_id:string;path:string;ordem:number;tipo:'foto'|'video';principal:boolean;nome_arquivo:string|null};
type Owner={id:string;property_id:string;client_id:string;data_inicio:string;data_fim:string|null;observacoes:string|null};

export default function Imoveis(){
 const db=useMemo(()=>supabase(),[]);
 const[rows,setRows]=useState<P[]>([]),[clients,setClients]=useState<Client[]>([]),[busca,setBusca]=useState(''),[status,setStatus]=useState(''),[edit,setEdit]=useState<P|null>(null),[media,setMedia]=useState<Media[]>([]),[owner,setOwner]=useState<Owner|null>(null),[ownerId,setOwnerId]=useState(''),[ownerObs,setOwnerObs]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);

 async function load(){
  const[a,b]=await Promise.all([
   db.from('properties').select('*').order('created_at',{ascending:false}),
   db.from('clients').select('id,nome,telefone').order('nome',{ascending:true})
  ]);
  if(a.error)setMsg('Erro ao carregar imóveis: '+a.error.message);else setRows((a.data??[]) as P[]);
  if(b.error)setMsg('Erro ao carregar clientes: '+b.error.message);else setClients((b.data??[]) as Client[]);
 }
 useEffect(()=>{load()},[]);

 const url=(path:string)=>db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

 async function abrir(p:P){
  setBusy(true);setMsg('');
  const[m,o]=await Promise.all([
   db.from('property_images').select('id,property_id,path,ordem,tipo,principal,nome_arquivo').eq('property_id',p.id).order('ordem'),
   db.from('property_owners').select('id,property_id,client_id,data_inicio,data_fim,observacoes').eq('property_id',p.id).is('data_fim',null).maybeSingle()
  ]);
  if(m.error){setBusy(false);return setMsg('Erro ao carregar mídias: '+m.error.message)}
  if(o.error){setBusy(false);return setMsg('Erro ao carregar proprietário: '+o.error.message)}
  setEdit({...p});setMedia((m.data??[]) as Media[]);
  const own=(o.data??null) as Owner|null;setOwner(own);setOwnerId(own?.client_id??'');setOwnerObs(own?.observacoes??'');
  setBusy(false);window.scrollTo({top:0,behavior:'smooth'});
 }

 async function salvar(e:FormEvent){
  e.preventDefault();if(!edit||busy)return;
  const fotos=media.filter(x=>x.tipo==='foto');
  if(edit.publicar_site&&fotos.length>0&&!fotos.some(x=>x.principal))return setMsg('Escolha uma foto como CAPA antes de publicar.');
  setBusy(true);setMsg('');
  const{data:{user}}=await db.auth.getUser();
  const{error}=await db.from('properties').update({
   titulo:edit.titulo,tipo:edit.tipo,cidade:edit.cidade,bairro:edit.bairro,endereco:edit.endereco,valor:edit.valor,
   dormitorios:edit.dormitorios,suites:edit.suites,vagas:edit.vagas,area_util:edit.area_util,descricao:edit.descricao,
   status:edit.status,destaque:edit.destaque,publicar_site:edit.publicar_site,updated_by:user?.id??null
  }).eq('id',edit.id);
  if(error){setBusy(false);return setMsg('Não foi possível atualizar: '+error.message)}

  if((owner?.client_id??'')!==ownerId){
   if(owner){
    const r=await db.from('property_owners').update({data_fim:new Date().toISOString()}).eq('id',owner.id);
    if(r.error){setBusy(false);return setMsg('Imóvel salvo, mas falhou ao encerrar proprietário anterior: '+r.error.message)}
   }
   if(ownerId){
    const r=await db.from('property_owners').insert({property_id:edit.id,client_id:ownerId,data_inicio:new Date().toISOString(),observacoes:ownerObs||null});
    if(r.error){setBusy(false);return setMsg('Imóvel salvo, mas falhou ao vincular proprietário: '+r.error.message)}
   }
  }else if(owner&&(owner.observacoes??'')!==ownerObs){
   const r=await db.from('property_owners').update({observacoes:ownerObs||null}).eq('id',owner.id);
   if(r.error){setBusy(false);return setMsg('Erro na observação do proprietário: '+r.error.message)}
  }
  setEdit(null);setMedia([]);setOwner(null);setOwnerId('');setOwnerObs('');setMsg('Imóvel atualizado.');setBusy(false);load();
 }

 async function capa(x:Media){
  if(!edit||busy)return;setBusy(true);
  let r=await db.from('property_images').update({principal:false}).eq('property_id',edit.id).eq('tipo','foto');
  if(r.error){setBusy(false);return setMsg('Erro ao trocar capa: '+r.error.message)}
  r=await db.from('property_images').update({principal:true}).eq('id',x.id);
  if(r.error){setBusy(false);return setMsg('Erro ao definir capa: '+r.error.message)}
  setMedia(v=>v.map(m=>({...m,principal:m.tipo==='foto'&&m.id===x.id})));setMsg('Capa alterada.');setBusy(false);
 }

 async function remover(x:Media){
  if(!confirm(`Excluir ${x.tipo==='video'?'o vídeo':'esta foto'}?`))return;
  setBusy(true);
  const s=await db.storage.from(BUCKET).remove([x.path]);if(s.error){setBusy(false);return setMsg('Erro no Storage: '+s.error.message)}
  const r=await db.from('property_images').delete().eq('id',x.id);if(r.error){setBusy(false);return setMsg('Arquivo removido, mas erro no registro: '+r.error.message)}
  setMedia(v=>v.filter(m=>m.id!==x.id));setMsg(x.tipo==='video'?'Vídeo removido.':'Foto removida.');setBusy(false);
 }

 async function fotosNovas(e:ChangeEvent<HTMLInputElement>){
  if(!edit||busy)return;const fs=Array.from(e.target.files??[]);e.target.value='';if(!fs.length)return;
  const atuais=media.filter(x=>x.tipo==='foto');
  if(atuais.length+fs.length>MAX_PHOTOS)return setMsg('Limite de 10 fotos por imóvel.');
  if(fs.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024))return setMsg('Fotos: JPEG, PNG ou WebP, máximo 5 MB cada.');
  setBusy(true);const novos:Media[]=[];
  for(let i=0;i<fs.length;i++){
   const f=fs[i],ext=f.name.split('.').pop()||'jpg',ordem=atuais.length+i+1,path=`${edit.id}/fotos/${String(ordem).padStart(2,'0')}-${crypto.randomUUID()}.${ext}`;
   const u=await db.storage.from(BUCKET).upload(path,f,{contentType:f.type,upsert:false});if(u.error){setBusy(false);return setMsg('Falha no upload: '+u.error.message)}
   const r=await db.from('property_images').insert({property_id:edit.id,path,ordem,tipo:'foto',principal:false,nome_arquivo:f.name}).select('id,property_id,path,ordem,tipo,principal,nome_arquivo').single();
   if(r.error){await db.storage.from(BUCKET).remove([path]);setBusy(false);return setMsg('Falha ao registrar foto: '+r.error.message)}
   novos.push(r.data as Media);
  }
  setMedia(v=>[...v,...novos]);setMsg(`${novos.length} foto(s) adicionada(s).`);setBusy(false);
 }

 async function videoNovo(e:ChangeEvent<HTMLInputElement>){
  if(!edit||busy)return;const f=e.target.files?.[0];e.target.value='';if(!f)return;
  if(media.some(x=>x.tipo==='video'))return setMsg('Remova o vídeo atual antes de enviar outro.');
  if(!['video/mp4','video/webm'].includes(f.type)||f.size>50*1024*1024)return setMsg('Vídeo: MP4 ou WebM, máximo 50 MB.');
  setBusy(true);const ext=f.name.split('.').pop()||'mp4',path=`${edit.id}/video/${crypto.randomUUID()}.${ext}`;
  const u=await db.storage.from(BUCKET).upload(path,f,{contentType:f.type,upsert:false});if(u.error){setBusy(false);return setMsg('Falha no vídeo: '+u.error.message)}
  const r=await db.from('property_images').insert({property_id:edit.id,path,ordem:1,tipo:'video',principal:false,nome_arquivo:f.name}).select('id,property_id,path,ordem,tipo,principal,nome_arquivo').single();
  if(r.error){await db.storage.from(BUCKET).remove([path]);setBusy(false);return setMsg('Falha ao registrar vídeo: '+r.error.message)}
  setMedia(v=>[...v,r.data as Media]);setMsg('Vídeo adicionado.');setBusy(false);
 }

 async function excluir(p:P){
  if(!confirm(`Excluir ${p.codigo??''} - ${p.titulo}? Esta ação não pode ser desfeita.`))return;
  const{error}=await db.from('properties').delete().eq('id',p.id);
  if(error)return setMsg('Não foi possível excluir. O imóvel pode possuir histórico/vínculos. Use status Inativo quando necessário.');
  setMsg('Imóvel excluído.');load();
 }

 const list=rows.filter(p=>(!status||p.status===status)&&[p.codigo,p.titulo,p.bairro,p.cidade].join(' ').toLowerCase().includes(busca.toLowerCase()));
 const photos=media.filter(x=>x.tipo==='foto').sort((a,b)=>a.ordem-b.ordem),video=media.find(x=>x.tipo==='video');

 return <div className="shell"><Nav/><main className="content">
  <header><div><span className="eyebrow">CADASTROS</span><h1>Imóveis</h1><p className="page-intro">Cadastre, consulte, edite, inative ou exclua imóveis.</p></div><a className="button" href="/imoveis/novo">+ Novo imóvel</a></header>
  {msg&&<div className="status">{msg}</div>}
  {edit&&<section className="panel form quick-form"><h2>Editar {edit.codigo}</h2><form onSubmit={salvar}>
   <div className="grid">
    <label>Título<input required value={edit.titulo} onChange={e=>setEdit({...edit,titulo:e.target.value})}/></label>
    <label>Tipo<select value={edit.tipo} onChange={e=>setEdit({...edit,tipo:e.target.value})}><option>Apartamento</option><option>Casa</option><option>Terreno</option><option>Comercial</option><option>Outro</option></select></label>
    <label>Status<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option><option value="inativo">Inativo</option></select></label>
    <label>Cidade<input value={edit.cidade??''} onChange={e=>setEdit({...edit,cidade:e.target.value})}/></label>
    <label>Bairro<input value={edit.bairro??''} onChange={e=>setEdit({...edit,bairro:e.target.value})}/></label>
    <label>Endereço<input value={edit.endereco??''} onChange={e=>setEdit({...edit,endereco:e.target.value})}/></label>
    <label>Valor<input type="number" value={edit.valor??''} onChange={e=>setEdit({...edit,valor:e.target.value?Number(e.target.value):null})}/></label>
    <label>Área útil<input type="number" value={edit.area_util??''} onChange={e=>setEdit({...edit,area_util:e.target.value?Number(e.target.value):null})}/></label>
    <label>Dormitórios<input type="number" min="0" value={edit.dormitorios} onChange={e=>setEdit({...edit,dormitorios:Number(e.target.value)})}/></label>
    <label>Suítes<input type="number" min="0" value={edit.suites} onChange={e=>setEdit({...edit,suites:Number(e.target.value)})}/></label>
    <label>Vagas<input type="number" min="0" value={edit.vagas} onChange={e=>setEdit({...edit,vagas:Number(e.target.value)})}/></label>
   </div>
   <label>Descrição<textarea value={edit.descricao??''} onChange={e=>setEdit({...edit,descricao:e.target.value})}/></label>
   <div className="checks"><label><input type="checkbox" checked={edit.destaque} onChange={e=>setEdit({...edit,destaque:e.target.checked})}/> Destaque</label><label><input type="checkbox" checked={edit.publicar_site} onChange={e=>setEdit({...edit,publicar_site:e.target.checked})}/> Publicar no site</label></div>

   <div className="media-upload"><div className="media-title"><div><b>Proprietário do imóvel</b><p>Selecione um cliente cadastrado. A troca preserva o histórico.</p></div></div>
    <label>Proprietário atual<select value={ownerId} onChange={e=>setOwnerId(e.target.value)}><option value="">Sem proprietário vinculado</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nome??'Cliente sem nome'}{c.telefone?` · ${c.telefone}`:''}</option>)}</select></label>
    <label>Observações internas<textarea value={ownerObs} onChange={e=>setOwnerObs(e.target.value)}/></label>
   </div>

   <div className="media-upload"><div className="media-title"><div><b>Fotos do imóvel</b><p>Até 10 fotos. JPEG, PNG ou WebP. Máximo 5 MB por foto.</p></div><strong>{photos.length} / 10</strong></div>
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||photos.length>=10} onChange={fotosNovas}/>
    {photos.length===0?<div className="media-help">Nenhuma foto cadastrada.</div>:<div className="property-media-grid">{photos.map(x=><article key={x.id} className={`property-media-card ${x.principal?'is-cover':''}`}>
     <div className="property-media-preview"><img src={url(x.path)} alt={x.nome_arquivo??'Foto do imóvel'}/>{x.principal&&<span className="cover-badge">CAPA</span>}</div>
     <div className="property-media-info"><small>Foto {x.ordem}</small><span>{x.nome_arquivo??'Imagem do imóvel'}</span></div>
     <div className="property-media-actions">{x.principal?<div className="cover-selected">✓ Foto principal / capa</div>:<button type="button" className="secondary-button" onClick={()=>capa(x)}>Definir como capa</button>}<button type="button" className="danger-button" onClick={()=>remover(x)}>Remover foto</button></div>
    </article>)}</div>}
   </div>

   <div className="media-upload"><div className="media-title"><div><b>Vídeo do imóvel</b><p>Opcional. 1 vídeo MP4 ou WebM, até 50 MB.</p></div><strong>{video?'1 / 1':'0 / 1'}</strong></div>
    {!video&&<input type="file" accept="video/mp4,video/webm" disabled={busy} onChange={videoNovo}/>}
    {video&&<div className="property-video-card"><video controls preload="metadata" src={url(video.path)}/><div className="property-media-info"><small>Vídeo</small><span>{video.nome_arquivo??'Vídeo do imóvel'}</span></div><button type="button" className="danger-button" onClick={()=>remover(video)}>Remover vídeo</button></div>}
   </div>

   <div className="actions"><button disabled={busy}>{busy?'Processando...':'Salvar alterações'}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setEdit(null);setMedia([]);setOwner(null);setOwnerId('');setOwnerObs('');setMsg('')}}>Cancelar</button></div>
  </form></section>}

  <section className="panel"><div className="toolbar"><input placeholder="Buscar por código, título ou bairro" value={busca} onChange={e=>setBusca(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option><option value="inativo">Inativo</option></select></div>
   {list.length===0?<div className="empty"><b>Nenhum imóvel encontrado.</b></div>:<div className="data-list">{list.map(p=><article className="data-card crud-card" key={p.id}><div><strong>{p.codigo??'Código automático'} · {p.titulo}</strong><span>{p.bairro??'—'} · {p.cidade??'—'}</span></div><div><small>Status</small><b>{p.status}</b></div><div className="row-actions"><button disabled={busy} onClick={()=>abrir(p)}>Editar</button><button className="danger-button" disabled={busy} onClick={()=>excluir(p)}>Excluir</button></div></article>)}</div>}
  </section>
 </main></div>
}
