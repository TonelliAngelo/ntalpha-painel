'use client';

import {ChangeEvent,FormEvent,useEffect,useMemo,useState} from 'react';
import Nav from '@/components/Nav';
import {supabase} from '@/lib/supabase';

const BUCKET='property-images', MAX_PHOTOS=10;

const PROPERTY_TYPES=[
 'Casa','Casa em Condomínio','Apartamento','Cobertura','Duplex','Triplex',
 'Sobrado','Terreno','Prédio','Galpão','Comercial / Sala','Outro'
];

const PROPERTY_FEATURES=[
 'Cozinha','Copa','Lavabo','Sala de estar','Sala de jantar','Sala de TV',
 'Varanda','Varanda gourmet','Área gourmet','Churrasqueira','Edícula',
 'Escritório / Home Office','Closet','Despensa','Área de serviço / Lavanderia',
 'Piscina privativa','Sauna','Jardim','Quintal','Lareira','Ar-condicionado',
 'Armários planejados'
];

type P={
 id:string;codigo:string|null;titulo:string;tipo:string;cidade:string|null;
 bairro:string|null;endereco:string|null;bloco_torre:string|null;unidade:string|null;
 complemento:string|null;andar:number|null;condominium_id:string|null;valor:number|null;
 valor_condominio:number|null;valor_iptu:number|null;dormitorios:number;suites:number;
 banheiros:number;vagas:number;area_util:number|null;area_total:number|null;
 ano_construcao:number|null;mobiliado:string|null;caracteristicas:string[]|null;
 outras_caracteristicas:string|null;descricao:string|null;status:string;
 destaque:boolean;publicar_site:boolean
};
type Client={id:string;nome:string|null;telefone:string|null};
type Condominium={id:string;nome:string};
type Media={id:string;property_id:string;path:string;ordem:number;tipo:'foto'|'video';principal:boolean;nome_arquivo:string|null};
type Owner={id:string;property_id:string;client_id:string;data_inicio:string;data_fim:string|null;observacoes:string|null};

export default function Imoveis(){
 const db=useMemo(()=>supabase(),[]);
 const[rows,setRows]=useState<P[]>([]);
 const[clients,setClients]=useState<Client[]>([]);
 const[condominiums,setCondominiums]=useState<Condominium[]>([]);
 const[busca,setBusca]=useState('');
 const[status,setStatus]=useState('');
 const[edit,setEdit]=useState<P|null>(null);
 const[view,setView]=useState<P|null>(null);
 const[media,setMedia]=useState<Media[]>([]);
 const[owner,setOwner]=useState<Owner|null>(null);
 const[ownerId,setOwnerId]=useState('');
 const[ownerObs,setOwnerObs]=useState('');
 const[msg,setMsg]=useState('');
 const[busy,setBusy]=useState(false);
 const[lightbox,setLightbox]=useState<number|null>(null);

 async function load(){
  const[a,b,c]=await Promise.all([
   db.from('properties').select('*').order('created_at',{ascending:false}),
   db.from('clients').select('id,nome,telefone').order('nome',{ascending:true}),
   db.from('condominiums').select('id,nome').order('nome',{ascending:true})
  ]);
  if(a.error)setMsg('Erro ao carregar imóveis: '+a.error.message);else setRows((a.data??[]) as P[]);
  if(b.error)setMsg('Erro ao carregar clientes: '+b.error.message);else setClients((b.data??[]) as Client[]);
  if(c.error)setMsg('Erro ao carregar condomínios: '+c.error.message);else setCondominiums((c.data??[]) as Condominium[]);
 }
 useEffect(()=>{void load()},[]);

 const url=(path:string)=>db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

 async function abrir(p:P){
  setBusy(true);setMsg('');
  const[m,o]=await Promise.all([
   db.from('property_images').select('id,property_id,path,ordem,tipo,principal,nome_arquivo').eq('property_id',p.id).order('ordem'),
   db.from('property_owners').select('id,property_id,client_id,data_inicio,data_fim,observacoes').eq('property_id',p.id).is('data_fim',null).maybeSingle()
  ]);
  if(m.error){setBusy(false);return setMsg('Erro ao carregar mídias: '+m.error.message)}
  if(o.error){setBusy(false);return setMsg('Erro ao carregar proprietário: '+o.error.message)}
  setEdit({...p,caracteristicas:p.caracteristicas??[]});
  setMedia((m.data??[]) as Media[]);
  const own=(o.data??null) as Owner|null;
  setOwner(own);setOwnerId(own?.client_id??'');setOwnerObs(own?.observacoes??'');
  setBusy(false);window.scrollTo({top:0,behavior:'smooth'});
 }

 async function visualizar(p:P){
  setBusy(true);setMsg('');
  const[m,o]=await Promise.all([
   db.from('property_images').select('id,property_id,path,ordem,tipo,principal,nome_arquivo').eq('property_id',p.id).order('ordem'),
   db.from('property_owners').select('id,property_id,client_id,data_inicio,data_fim,observacoes').eq('property_id',p.id).is('data_fim',null).maybeSingle()
  ]);
  if(m.error){setBusy(false);return setMsg('Erro ao carregar mídias: '+m.error.message)}
  if(o.error){setBusy(false);return setMsg('Erro ao carregar proprietário: '+o.error.message)}
  setEdit(null);setView({...p,caracteristicas:p.caracteristicas??[]});setMedia((m.data??[]) as Media[]);
  const own=(o.data??null) as Owner|null;setOwner(own);setOwnerId(own?.client_id??'');setOwnerObs(own?.observacoes??'');
  setBusy(false);window.scrollTo({top:0,behavior:'smooth'});
 }

 function toggleFeature(feature:string){
  if(!edit)return;
  const current=edit.caracteristicas??[];
  setEdit({...edit,caracteristicas:current.includes(feature)?current.filter(x=>x!==feature):[...current,feature]});
 }

 async function salvar(e:FormEvent){
  e.preventDefault();if(!edit||busy)return;
  const fotos=media.filter(x=>x.tipo==='foto');
  if(edit.publicar_site&&fotos.length===0)return setMsg('Para publicar no site, adicione pelo menos uma foto.');
  if(edit.publicar_site&&!fotos.some(x=>x.principal))return setMsg('Escolha uma foto como CAPA antes de publicar.');
  if(!ownerId)return setMsg('Selecione um proprietário para o imóvel.');
  setBusy(true);setMsg('');
  const{data:{user}}=await db.auth.getUser();
  const{error}=await db.from('properties').update({
   titulo:edit.titulo,tipo:edit.tipo,cidade:edit.cidade,bairro:edit.bairro,endereco:edit.endereco,
   bloco_torre:edit.bloco_torre,unidade:edit.unidade,complemento:edit.complemento,andar:edit.andar,
   condominium_id:edit.condominium_id,valor:edit.valor,valor_condominio:edit.valor_condominio,
   valor_iptu:edit.valor_iptu,dormitorios:edit.dormitorios,suites:edit.suites,banheiros:edit.banheiros,
   vagas:edit.vagas,area_util:edit.area_util,area_total:edit.area_total,ano_construcao:edit.ano_construcao,
   mobiliado:edit.mobiliado,caracteristicas:edit.caracteristicas??[],
   outras_caracteristicas:edit.outras_caracteristicas,descricao:edit.descricao,status:edit.status,
   destaque:edit.destaque,publicar_site:edit.publicar_site,updated_by:user?.id??null
  }).eq('id',edit.id);
  if(error){setBusy(false);return setMsg('Não foi possível atualizar: '+error.message)}

  if((owner?.client_id??'')!==ownerId){
   if(owner){
    const r=await db.from('property_owners').update({data_fim:new Date().toISOString()}).eq('id',owner.id);
    if(r.error){setBusy(false);return setMsg('Imóvel salvo, mas falhou ao encerrar proprietário anterior: '+r.error.message)}
   }
   const r=await db.from('property_owners').insert({property_id:edit.id,client_id:ownerId,data_inicio:new Date().toISOString(),observacoes:ownerObs||null});
   if(r.error){setBusy(false);return setMsg('Imóvel salvo, mas falhou ao vincular proprietário: '+r.error.message)}
  }else if(owner&&(owner.observacoes??'')!==ownerObs){
   const r=await db.from('property_owners').update({observacoes:ownerObs||null}).eq('id',owner.id);
   if(r.error){setBusy(false);return setMsg('Erro na observação do proprietário: '+r.error.message)}
  }
  setEdit(null);setMedia([]);setOwner(null);setOwnerId('');setOwnerObs('');
  setMsg('Imóvel atualizado.');setBusy(false);void load();
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
   const r=await db.from('property_images').insert({property_id:edit.id,path,ordem,tipo:'foto',principal:false,nome_arquivo:f.name,mime_type:f.type,tamanho_bytes:f.size}).select('id,property_id,path,ordem,tipo,principal,nome_arquivo').single();
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
  const r=await db.from('property_images').insert({property_id:edit.id,path,ordem:1,tipo:'video',principal:false,nome_arquivo:f.name,mime_type:f.type,tamanho_bytes:f.size}).select('id,property_id,path,ordem,tipo,principal,nome_arquivo').single();
  if(r.error){await db.storage.from(BUCKET).remove([path]);setBusy(false);return setMsg('Falha ao registrar vídeo: '+r.error.message)}
  setMedia(v=>[...v,r.data as Media]);setMsg('Vídeo adicionado.');setBusy(false);
 }

 async function excluir(p:P){
  if(!confirm(`Excluir ${p.codigo??''} - ${p.titulo}? Esta ação não pode ser desfeita.`))return;
  const{error}=await db.from('properties').delete().eq('id',p.id);
  if(error)return setMsg('Não foi possível excluir. O imóvel pode possuir histórico/vínculos. Use status Inativo quando necessário.');
  setMsg('Imóvel excluído.');void load();
 }

 const list=rows.filter(p=>(!status||p.status===status)&&[p.codigo,p.titulo,p.bairro,p.cidade].join(' ').toLowerCase().includes(busca.toLowerCase()));
 const photos=media.filter(x=>x.tipo==='foto').sort((a,b)=>a.ordem-b.ordem),video=media.find(x=>x.tipo==='video');

 const n=(value:string)=>value===''?null:Number(value);

 return <div className="shell"><Nav/><main className="content">
  <header><div><span className="eyebrow">CADASTROS</span><h1>Imóveis</h1><p className="page-intro">Cadastre, consulte, edite, inative ou exclua imóveis.</p></div><a className="button" href="/imoveis/novo">+ Novo imóvel</a></header>
  {msg&&<div className="status">{msg}</div>}

  {view&&<section className="panel property-admin-view">
   <div className="property-admin-head">
    <div><span className="eyebrow">FICHA DO IMÓVEL</span><h2>{view.codigo??'—'} · {view.titulo}</h2><p className="page-intro">{view.tipo} · {view.bairro??'—'} · {view.cidade??'—'}</p></div>
    <div className="actions"><button type="button" onClick={()=>{const p=view;setView(null);void abrir(p)}}>Editar cadastro</button><button type="button" className="secondary-button" onClick={()=>{setView(null);setLightbox(null);setMedia([]);setOwner(null);setOwnerId('');setOwnerObs('');setMsg('')}}>← Voltar para imóveis</button></div>
   </div>

   <div className="property-admin-summary">
    <div><small>Valor de venda</small><strong>{view.valor!=null?view.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}</strong></div>
    <div><small>Área útil</small><strong>{view.area_util!=null?`${view.area_util} m²`:'—'}</strong></div>
    <div><small>Área total</small><strong>{view.area_total!=null?`${view.area_total} m²`:'—'}</strong></div>
    <div><small>Status</small><strong>{view.status}</strong></div>
   </div>

   <div className="property-admin-columns">
    <section className="property-admin-card"><h3>Dados do imóvel</h3><div className="property-admin-fields">
     <div><small>Tipo</small><strong>{view.tipo}</strong></div><div><small>Dormitórios</small><strong>{view.dormitorios}</strong></div><div><small>Suítes</small><strong>{view.suites}</strong></div><div><small>Banheiros</small><strong>{view.banheiros}</strong></div><div><small>Vagas</small><strong>{view.vagas}</strong></div><div><small>Andar</small><strong>{view.andar??'—'}</strong></div><div><small>Ano de construção</small><strong>{view.ano_construcao??'—'}</strong></div><div><small>Mobiliado</small><strong>{view.mobiliado==='sim'?'Sim':view.mobiliado==='parcial'?'Parcialmente':view.mobiliado==='nao'?'Não':'—'}</strong></div>
    </div></section>

    <section className="property-admin-card"><h3>Localização</h3><div className="property-admin-fields">
     <div><small>Condomínio</small><strong>{condominiums.find(c=>c.id===view.condominium_id)?.nome??'Sem condomínio'}</strong></div><div><small>Cidade</small><strong>{view.cidade??'—'}</strong></div><div><small>Bairro / Região</small><strong>{view.bairro??'—'}</strong></div><div><small>Endereço</small><strong>{view.endereco??'—'}</strong></div><div><small>Bloco / Torre</small><strong>{view.bloco_torre??'—'}</strong></div><div><small>Unidade</small><strong>{view.unidade??'—'}</strong></div><div><small>Complemento</small><strong>{view.complemento??'—'}</strong></div>
    </div></section>

    <section className="property-admin-card"><h3>Proprietário</h3><div className="property-admin-fields">
     <div><small>Nome</small><strong>{clients.find(c=>c.id===owner?.client_id)?.nome??'—'}</strong></div><div><small>Telefone</small><strong>{clients.find(c=>c.id===owner?.client_id)?.telefone??'—'}</strong></div>
    </div>{owner?.observacoes&&<div className="property-admin-note"><small>Observações internas</small><p>{owner.observacoes}</p></div>}</section>

    <section className="property-admin-card"><h3>Valores e publicação</h3><div className="property-admin-fields">
     <div><small>Venda</small><strong>{view.valor!=null?view.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}</strong></div><div><small>Condomínio</small><strong>{view.valor_condominio!=null?view.valor_condominio.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}</strong></div><div><small>IPTU</small><strong>{view.valor_iptu!=null?view.valor_iptu.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}</strong></div><div><small>Publicado no site</small><strong>{view.publicar_site?'Sim':'Não'}</strong></div><div><small>Destaque</small><strong>{view.destaque?'Sim':'Não'}</strong></div>
    </div></section>
   </div>

   <section className="property-admin-card property-admin-wide"><h3>Características e descrição</h3>
    {(view.caracteristicas??[]).length>0&&<div className="property-admin-tags">{(view.caracteristicas??[]).map(x=><span key={x}>{x}</span>)}</div>}
    {view.outras_caracteristicas&&<p>{view.outras_caracteristicas}</p>}<p className="property-admin-description">{view.descricao??'Nenhuma descrição cadastrada.'}</p>
   </section>

   <section className="property-admin-card property-admin-wide"><div className="property-admin-media-title"><div><h3>Fotos do imóvel</h3><p>Clique em uma imagem para ampliar.</p></div><strong>{photos.length} foto(s)</strong></div>
    {photos.length===0?<div className="media-help">Nenhuma foto cadastrada.</div>:<div className="property-admin-thumbs">{photos.map((x,i)=><button type="button" key={x.id} onClick={()=>setLightbox(i)} aria-label={`Ampliar foto ${i+1}`}><img src={url(x.path)} alt={x.nome_arquivo??`Foto ${i+1}`}/>{x.principal&&<span>CAPA</span>}</button>)}</div>}
    {video&&<div className="property-admin-video"><small>Vídeo cadastrado</small><video controls preload="metadata" src={url(video.path)}/></div>}
   </section>

   {lightbox!==null&&photos[lightbox]&&<div className="property-admin-lightbox" role="dialog" aria-modal="true" onClick={()=>setLightbox(null)}>
    <button type="button" className="property-admin-lightbox-close" onClick={()=>setLightbox(null)}>×</button>
    {photos.length>1&&<button type="button" className="property-admin-lightbox-prev" onClick={e=>{e.stopPropagation();setLightbox((lightbox-1+photos.length)%photos.length)}}>‹</button>}
    <div className="property-admin-lightbox-content" onClick={e=>e.stopPropagation()}><img src={url(photos[lightbox].path)} alt={photos[lightbox].nome_arquivo??`Foto ${lightbox+1}`}/><span>{lightbox+1} de {photos.length}</span></div>
    {photos.length>1&&<button type="button" className="property-admin-lightbox-next" onClick={e=>{e.stopPropagation();setLightbox((lightbox+1)%photos.length)}}>›</button>}
   </div>}
  </section>}

  {edit&&<section className="panel form quick-form">
   <h2>Editar {edit.codigo}</h2>
   <form onSubmit={salvar}>

    <section className="form-section">
     <h2>1. Proprietário</h2>
     <div className="grid">
      <label>Proprietário atual *
       <select required value={ownerId} onChange={e=>setOwnerId(e.target.value)}>
        <option value="">Selecione...</option>
        {clients.map(c=><option key={c.id} value={c.id}>{c.nome??'Cliente sem nome'}{c.telefone?` · ${c.telefone}`:''}</option>)}
       </select>
      </label>
     </div>
     <label>Observações internas<textarea rows={3} value={ownerObs} onChange={e=>setOwnerObs(e.target.value)}/></label>
    </section>

    <section className="form-section">
     <h2>2. Condomínio e localização</h2>
     <div className="grid">
      <label>Condomínio / Empreendimento
       <select value={edit.condominium_id??''} onChange={e=>setEdit({...edit,condominium_id:e.target.value||null})}>
        <option value="">Sem condomínio</option>
        {condominiums.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
       </select>
      </label>
      <label>Cidade<input value={edit.cidade??''} onChange={e=>setEdit({...edit,cidade:e.target.value})}/></label>
      <label>Bairro / Região<input value={edit.bairro??''} onChange={e=>setEdit({...edit,bairro:e.target.value})}/></label>
      <label>Endereço do imóvel<input value={edit.endereco??''} onChange={e=>setEdit({...edit,endereco:e.target.value})}/></label>
      <label>Bloco / Torre<input value={edit.bloco_torre??''} onChange={e=>setEdit({...edit,bloco_torre:e.target.value})}/></label>
      <label>Unidade / Apartamento<input value={edit.unidade??''} onChange={e=>setEdit({...edit,unidade:e.target.value})}/></label>
      <label>Complemento<input value={edit.complemento??''} onChange={e=>setEdit({...edit,complemento:e.target.value})}/></label>
      <label>Andar<input type="number" min="0" value={edit.andar??''} onChange={e=>setEdit({...edit,andar:n(e.target.value)})}/></label>
     </div>
    </section>

    <section className="form-section">
     <h2>3. Dados do imóvel</h2>
     <div className="grid">
      <label>Título *<input required value={edit.titulo} onChange={e=>setEdit({...edit,titulo:e.target.value})}/></label>
      <label>Tipo<select value={edit.tipo} onChange={e=>setEdit({...edit,tipo:e.target.value})}>{PROPERTY_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Dormitórios<input type="number" min="0" value={edit.dormitorios??0} onChange={e=>setEdit({...edit,dormitorios:Number(e.target.value)})}/></label>
      <label>Suítes<input type="number" min="0" value={edit.suites??0} onChange={e=>setEdit({...edit,suites:Number(e.target.value)})}/></label>
      <label>Banheiros<input type="number" min="0" value={edit.banheiros??0} onChange={e=>setEdit({...edit,banheiros:Number(e.target.value)})}/></label>
      <label>Vagas<input type="number" min="0" value={edit.vagas??0} onChange={e=>setEdit({...edit,vagas:Number(e.target.value)})}/></label>
      <label>Área útil / construída (m²)<input type="number" min="0" step="0.01" value={edit.area_util??''} onChange={e=>setEdit({...edit,area_util:n(e.target.value)})}/></label>
      <label>Área total / terreno (m²)<input type="number" min="0" step="0.01" value={edit.area_total??''} onChange={e=>setEdit({...edit,area_total:n(e.target.value)})}/></label>
      <label>Ano de construção<input type="number" min="0" value={edit.ano_construcao??''} onChange={e=>setEdit({...edit,ano_construcao:n(e.target.value)})}/></label>
      <label>Mobiliado
       <select value={edit.mobiliado??''} onChange={e=>setEdit({...edit,mobiliado:e.target.value||null})}>
        <option value="">Não informado</option><option value="nao">Não</option><option value="parcial">Parcialmente</option><option value="sim">Sim</option>
       </select>
      </label>
     </div>
    </section>

    <section className="form-section">
     <h2>4. Valores</h2>
     <div className="grid">
      <label>Valor de venda (R$)<input type="number" min="0" step="0.01" value={edit.valor??''} onChange={e=>setEdit({...edit,valor:n(e.target.value)})}/></label>
      <label>Condomínio (R$)<input type="number" min="0" step="0.01" value={edit.valor_condominio??''} onChange={e=>setEdit({...edit,valor_condominio:n(e.target.value)})}/></label>
      <label>IPTU (R$)<input type="number" min="0" step="0.01" value={edit.valor_iptu??''} onChange={e=>setEdit({...edit,valor_iptu:n(e.target.value)})}/></label>
     </div>
    </section>

    <section className="form-section">
     <h2>5. Características</h2>
     <div className="feature-grid">
      {PROPERTY_FEATURES.map(x=><label key={x}><input type="checkbox" checked={(edit.caracteristicas??[]).includes(x)} onChange={()=>toggleFeature(x)}/> {x}</label>)}
     </div>
     <label>Outras características<textarea rows={3} value={edit.outras_caracteristicas??''} onChange={e=>setEdit({...edit,outras_caracteristicas:e.target.value})}/></label>
    </section>

    <section className="form-section">
     <h2>6. Apresentação</h2>
     <label>Descrição<textarea rows={6} value={edit.descricao??''} onChange={e=>setEdit({...edit,descricao:e.target.value})}/></label>
    </section>

    <section className="media-upload form-section">
     <div className="media-title"><div><h2>7. Fotos do imóvel</h2><p>Até 10 fotos. JPEG, PNG ou WebP. Máximo 5 MB por foto.</p></div><strong>{photos.length} / 10</strong></div>
     <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||photos.length>=10} onChange={fotosNovas}/>
     {photos.length===0?<div className="media-help">Nenhuma foto cadastrada.</div>:<div className="property-media-grid">{photos.map(x=><article key={x.id} className={`property-media-card ${x.principal?'is-cover':''}`}>
      <div className="property-media-preview"><img src={url(x.path)} alt={x.nome_arquivo??'Foto do imóvel'}/>{x.principal&&<span className="cover-badge">CAPA</span>}</div>
      <div className="property-media-info"><small>Foto {x.ordem}</small><span>{x.nome_arquivo??'Imagem do imóvel'}</span></div>
      <div className="property-media-actions">{x.principal?<div className="cover-selected">✓ Foto principal / capa</div>:<button type="button" className="secondary-button" onClick={()=>capa(x)}>Definir como capa</button>}<button type="button" className="danger-button" onClick={()=>remover(x)}>Remover foto</button></div>
     </article>)}</div>}
    </section>

    <section className="media-upload form-section">
     <div className="media-title"><div><h2>8. Vídeo do imóvel</h2><p>Opcional. 1 vídeo MP4 ou WebM, até 50 MB.</p></div><strong>{video?'1 / 1':'0 / 1'}</strong></div>
     {!video&&<input type="file" accept="video/mp4,video/webm" disabled={busy} onChange={videoNovo}/>}
     {video&&<div className="property-video-card"><video controls preload="metadata" src={url(video.path)}/><div className="property-media-info"><small>Vídeo</small><span>{video.nome_arquivo??'Vídeo do imóvel'}</span></div><button type="button" className="danger-button" onClick={()=>remover(video)}>Remover vídeo</button></div>}
    </section>

    <section className="form-section">
     <h2>9. Gestão e publicação</h2>
     <div className="grid">
      <label>Status<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option><option value="inativo">Inativo</option></select></label>
     </div>
     <div className="checks"><label><input type="checkbox" checked={edit.destaque} onChange={e=>setEdit({...edit,destaque:e.target.checked})}/> Destaque</label><label><input type="checkbox" checked={edit.publicar_site} onChange={e=>setEdit({...edit,publicar_site:e.target.checked})}/> Publicar no site</label></div>
    </section>

    <div className="actions"><button disabled={busy}>{busy?'Processando...':'Salvar alterações'}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setEdit(null);setMedia([]);setOwner(null);setOwnerId('');setOwnerObs('');setMsg('')}}>Cancelar</button></div>
   </form>
  </section>}

  <section className="panel"><div className="toolbar"><input placeholder="Buscar por código, título ou bairro" value={busca} onChange={e=>setBusca(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option><option value="inativo">Inativo</option></select></div>
   {list.length===0?<div className="empty"><b>Nenhum imóvel encontrado.</b></div>:<div className="data-list">{list.map(p=><article className="data-card crud-card" key={p.id}><div><strong>{p.codigo??'Código automático'} · {p.titulo}</strong><span>{p.bairro??'—'} · {p.cidade??'—'}</span></div><div><small>Status</small><b>{p.status}</b></div><div className="row-actions"><button className="secondary-button" disabled={busy} onClick={()=>visualizar(p)}>Visualizar</button><button disabled={busy} onClick={()=>abrir(p)}>Editar</button><button className="danger-button" disabled={busy} onClick={()=>excluir(p)}>Excluir</button></div></article>)}</div>}
  </section>
 </main></div>
}
