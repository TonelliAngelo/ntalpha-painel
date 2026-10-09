import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok:false, error:'Supabase de servidor não configurado.' }, { status:500 });

  const db = createClient(url, key, { auth:{autoRefreshToken:false,persistSession:false} });

  const { data: pubs, error: pe } = await db
    .from('property_publications')
    .select('property_id,channel,enabled')
    .in('channel',['olx','zap','vivareal']);

  if (pe) return NextResponse.json({ok:false,error:pe.message},{status:500});

  const ids=[...new Set((pubs??[]).filter(p=>p.enabled).map(p=>p.property_id))];
  if(!ids.length) return NextResponse.json({ok:true,total:0,validos:0,pendencias:[],feed:'/api/integracao/vrsync'});

  const {data: props,error: xe}=await db.from('properties').select('id,codigo,titulo,tipo,status,cep,cidade,bairro,valor,area_util,descricao').in('id',ids);
  if(xe) return NextResponse.json({ok:false,error:xe.message},{status:500});

  const {data: imgs}=await db.from('property_images').select('property_id,path,tipo,principal,ordem').in('property_id',ids).eq('tipo','foto');

  const pendencias=(props??[]).map(p=>{
    const pi=(imgs??[]).filter(i=>i.property_id===p.id && /\.(jpe?g)$/i.test(i.path??''));
    const issues:string[]=[];
    if(p.status!=='disponivel') issues.push('imóvel não está disponível');
    if(!p.codigo) issues.push('código do imóvel ausente');
    if(!p.titulo || p.titulo.length<10 || p.titulo.length>100) issues.push('título deve ter entre 10 e 100 caracteres');
    if(!p.cep) issues.push('CEP ausente');
    if(!p.cidade) issues.push('cidade ausente');
    if(!p.bairro) issues.push('bairro ausente');
    if(!p.descricao || p.descricao.replace(/<[^>]*>/g,' ').trim().length<50) issues.push('descrição com menos de 50 caracteres');
    if(p.area_util==null && !/terreno|lote|galpão|galpao|depósito|deposito|armazém|armazem/i.test(p.tipo??'')) issues.push('área útil ausente');
    if(pi.length<5) issues.push(`apenas ${pi.length} fotos JPG/JPEG; o portal exige no mínimo 5`);
    if(!(imgs??[]).some(i=>i.property_id===p.id && i.principal && /\.(jpe?g)$/i.test(i.path??''))) issues.push('não há foto JPG/JPEG definida como capa');

    return {codigo:p.codigo,titulo:p.titulo,property_id:p.id,valid:issues.length===0,issues};
  });

  const validos=pendencias.filter(x=>x.valid).length;
  return NextResponse.json({
    ok:true,
    total:pendencias.length,
    validos,
    invalidos:pendencias.length-validos,
    pendencias,
    feed:'/api/integracao/vrsync'
  });
}
