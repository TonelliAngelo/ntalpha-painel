import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from '@/lib/server-env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STORAGE_BUCKET = 'property-images';

function xml(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalize(value: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function int(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function subtype(tipo: string | null) {
  const t = normalize(tipo);

  if (t.includes('apart')) return 'Apartamento Padrão';
  if (t.includes('cobertura')) return 'Cobertura';
  if (t.includes('flat')) return 'Flat';
  if (t.includes('loft')) return 'Loft';
  if (t.includes('kitnet') || t.includes('conjugado') || t.includes('studio')) {
    return 'Kitnet / Studio';
  }
  if (t.includes('casa de condominio') || t.includes('casa em condominio')) {
    return 'Casa em Condomínio';
  }
  if (t === 'casa' || t.startsWith('casa ')) return 'Casa Padrão';
  if (t.includes('sobrado')) return 'Sobrado Residencial';
  if (t.includes('terreno') || t.includes('lote')) return 'Terreno';
  if (t.includes('chacara')) return 'Chácara';
  if (t.includes('fazenda')) return 'Fazenda Rural';
  if (t.includes('sitio')) return 'Sítio Rural';
  if (t.includes('galpao') || t.includes('deposito') || t.includes('armazem')) {
    return 'Galpão Comercial';
  }
  if (t.includes('sala') || t.includes('conjunto')) return 'Conjunto Comercial / Sala';
  if (t.includes('loja') || t.includes('salao') || t.includes('ponto comercial')) {
    return 'Loja Comercial';
  }
  if (t.includes('predio')) return 'Prédio Comercial';

  return 'Comercial';
}

function fotoUrl(baseUrl: string, path: string) {
  return `${baseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function description(value: string | null) {
  const clean = (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return clean.slice(0, 6000);
}

function cappedTitle(value: string | null, fallback: string) {
  const title = (value ?? fallback).replace(/\s+/g, ' ').trim();
  return title.slice(0, 90);
}

export async function GET() {
  const config = await getServerSupabaseConfig();

  if (!config.url || !config.secretKey) {
    return new NextResponse('Integração NT ALPHA não configurada.', { status: 500 });
  }

  const db = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: publications, error: pubError } = await db
    .from('property_publications')
    .select('property_id,channel,enabled')
    .eq('channel', 'olx')
    .eq('enabled', true);

  if (pubError) {
    return new NextResponse(`Erro nas publicações: ${pubError.message}`, { status: 500 });
  }

  const ids = [...new Set((publications ?? []).map((p) => p.property_id))];

  if (!ids.length) {
    return new NextResponse(
      `<?xml version="1.0" encoding="utf-8"?>
<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Imoveis/>
</Carga>`,
      { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }

  const { data: properties, error: propertyError } = await db
    .from('properties')
    .select(`
      id,codigo,tipo,titulo,cep,cidade,bairro,valor,valor_condominio,valor_iptu,
      dormitorios,banheiros,vagas,area_util,area_total,descricao,status
    `)
    .in('id', ids)
    .eq('status', 'disponivel');

  if (propertyError) {
    return new NextResponse(`Erro nos imóveis: ${propertyError.message}`, { status: 500 });
  }

  const propertyIds = (properties ?? []).map((p) => p.id);

  const { data: images, error: imageError } = await db
    .from('property_images')
    .select('property_id,path,principal,ordem,tipo')
    .in('property_id', propertyIds)
    .eq('tipo', 'foto')
    .order('ordem', { ascending: true });

  if (imageError) {
    return new NextResponse(`Erro nas imagens: ${imageError.message}`, { status: 500 });
  }

  const xmlProperties = (properties ?? []).map((p) => {
    const propertyImages = (images ?? [])
      .filter((i) => i.property_id === p.id && /\.(jpe?g)$/i.test(i.path ?? ''))
      .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));

    const title = cappedTitle(p.titulo, `${subtype(p.tipo)} em ${p.cidade ?? 'São Paulo'}`);
    const desc = description(p.descricao);

    const photos = propertyImages.map((i, index) => {
      const principal =
        i.principal || (index === 0 && !propertyImages.some((x) => x.principal));

      return `<Foto>${principal ? '<Principal>1</Principal>' : ''}<URLArquivo>${xml(fotoUrl(config.url, i.path))}</URLArquivo></Foto>`;
    }).join('');

    const type = normalize(p.tipo);
    const isApartment =
      type.includes('apart') || type.includes('cobertura') ||
      type.includes('flat') || type.includes('loft') ||
      type.includes('kitnet') || type.includes('conjugado') ||
      type.includes('studio');
    const isHouse = type.includes('casa') || type.includes('sobrado');
    const isCommercial = !isApartment && !isHouse &&
      !type.includes('terreno') && !type.includes('lote') &&
      !type.includes('chacara') && !type.includes('fazenda') &&
      !type.includes('sitio');

    const bedrooms = int(p.dormitorios);
    const bathrooms = int(p.banheiros);
    const garage = int(p.vagas);
    const sale = int(p.valor);
    const condo = int(p.valor_condominio);
    const iptu = int(p.valor_iptu);
    const totalArea = int(p.area_total);
    const usefulArea = int(p.area_util);

    const specific = [
      (isApartment || isHouse) && bedrooms !== null ? `<QtdDormitorios>${Math.max(0, Math.min(5, bedrooms))}</QtdDormitorios>` : '',
      (isApartment || isHouse) && bathrooms !== null ? `<QtdBanheiros>${Math.max(0, Math.min(5, bathrooms))}</QtdBanheiros>` : '',
      (isApartment || isHouse || isCommercial) && garage !== null ? `<QtdVagas>${Math.max(0, Math.min(5, garage))}</QtdVagas>` : '',
    ].join('');

    const area = totalArea !== null
      ? `<AreaTotal>${totalArea}</AreaTotal>`
      : usefulArea !== null
        ? `<AreaUtil>${usefulArea}</AreaUtil>`
        : '';

    return `<Imovel>
      <CodigoImovel>${xml(String(p.codigo ?? p.id).slice(0, 20))}</CodigoImovel>
      <TituloAnuncio>${xml(title)}</TituloAnuncio>
      <SubTipoImovel>${xml(subtype(p.tipo))}</SubTipoImovel>
      <Cidade>${xml(p.cidade)}</Cidade>
      <Bairro>${xml(p.bairro)}</Bairro>
      <CEP>${xml(p.cep)}</CEP>
      ${sale !== null ? `<PrecoVenda>${sale}</PrecoVenda>` : ''}
      ${condo !== null ? `<PrecoCondominio>${condo}</PrecoCondominio>` : ''}
      ${iptu !== null ? `<ValorIPTU>${iptu}</ValorIPTU>` : ''}
      ${specific}
      ${area}
      <Observacao>${xml(desc)}</Observacao>
      <Fotos>${photos}</Fotos>
    </Imovel>`;
  }).join('');

  const document = `<?xml version="1.0" encoding="utf-8"?>
<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Imoveis>${xmlProperties}</Imoveis>
</Carga>`;

  return new NextResponse(document, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
