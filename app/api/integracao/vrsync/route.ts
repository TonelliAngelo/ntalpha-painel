import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_BASE_URL =
  process.env.NTALPHA_PUBLIC_BASE_URL ?? 'https://painel.ntalpha.com.br';

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

function cdata(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return `<![CDATA[${String(value).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function int(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function propertyType(tipo: string | null) {
  const t = (tipo ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

  if (t.includes('apart')) return 'Residential / Apartment';
  if (t.includes('casa de condominio') || t.includes('casa em condominio')) return 'Residential / Condo';
  if (t === 'casa' || t.includes('casa ')) return 'Residential / Home';
  if (t.includes('sobrado')) return 'Residential / Sobrado';
  if (t.includes('cobertura')) return 'Residential / Penthouse';
  if (t.includes('flat')) return 'Residential / Flat';
  if (t.includes('kitnet') || t.includes('conjugado')) return 'Residential / Kitnet';
  if (t.includes('studio')) return 'Residential / Studio';
  if (t.includes('loft')) return 'Residential / Loft';
  if (t.includes('chacara') || t.includes('chácara')) return 'Residential / Farm Ranch';
  if (t.includes('fazenda') || t.includes('sitio') || t.includes('sítio')) return 'Residential / Agricultural';
  if (t.includes('terreno') || t.includes('lote')) return 'Residential / Land Lot';
  if (t.includes('galpao') || t.includes('galpão') || t.includes('deposito') || t.includes('depósito') || t.includes('armazem') || t.includes('armazém')) return 'Commercial / Industrial';
  if (t.includes('sala') || t.includes('conjunto')) return 'Commercial / Office';
  if (t.includes('loja') || t.includes('salao') || t.includes('salão') || t.includes('ponto comercial')) return 'Commercial / Business';
  if (t.includes('consultorio') || t.includes('consultório')) return 'Commercial / Consultorio';
  if (t.includes('predio') || t.includes('prédio')) return 'Commercial / Edificio Comercial';
  return 'Commercial / Building';
}

function usageType(tipo: string | null) {
  const t = (tipo ?? '').toLowerCase();
  const residential = ['apart', 'casa', 'sobrado', 'cobertura', 'flat', 'kitnet', 'studio', 'loft', 'chac', 'fazenda', 'sitio', 'sítio', 'terreno', 'lote'];
  return residential.some((x) => t.includes(x)) ? 'Residential' : 'Commercial';
}

function displayAddress(exibir: boolean | null | undefined) {
  return exibir === false ? 'Neighborhood' : 'All';
}

function fotoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

function normalizeDescription(description: string | null) {
  const clean = (description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length >= 50 ? clean.slice(0, 3000) : `${clean} NT ALPHA Imóveis.`;
}

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new NextResponse('Integração NT ALPHA não configurada.', { status: 500 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: publications, error: pubError } = await db
    .from('property_publications')
    .select('property_id,channel,enabled')
    .in('channel', ['olx', 'zap', 'vivareal'])
    .eq('enabled', true);

  if (pubError) {
    return new NextResponse(`Erro nas publicações: ${pubError.message}`, { status: 500 });
  }

  const propertyIds = [...new Set((publications ?? []).map((p) => p.property_id))];

  if (!propertyIds.length) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"><Listings/></ListingDataFeed>`,
      { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }

  const { data: properties, error: propertyError } = await db
    .from('properties')
    .select(`
      id,codigo,tipo,titulo,estado,cep,cidade,bairro,endereco,numero,
      exibir_endereco,complemento,valor,valor_condominio,valor_iptu,
      dormitorios,suites,banheiros,vagas,area_util,area_total,ano_construcao,
      mobiliado,caracteristicas,outras_caracteristicas,descricao,status,destaque
    `)
    .in('id', propertyIds)
    .eq('status', 'disponivel');

  if (propertyError) {
    return new NextResponse(`Erro nos imóveis: ${propertyError.message}`, { status: 500 });
  }

  const ids = (properties ?? []).map((p) => p.id);

  const { data: images } = await db
    .from('property_images')
    .select('property_id,path,tipo,principal,ordem')
    .in('property_id', ids)
    .eq('tipo', 'foto')
    .order('ordem', { ascending: true });

  const enabledByProperty = new Map<string, Set<string>>();
  for (const p of publications ?? []) {
    if (!enabledByProperty.has(p.property_id)) enabledByProperty.set(p.property_id, new Set());
    enabledByProperty.get(p.property_id)!.add(p.channel);
  }

  const xmlListings = (properties ?? []).map((p) => {
    const type = propertyType(p.tipo);
    const usage = usageType(p.tipo);
    const propertyImages = (images ?? [])
      .filter((i) => i.property_id === p.id && /\\.(jpe?g)$/i.test(i.path ?? ''))
      .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));

    const price = int(p.valor);
    const condo = int(p.valor_condominio);
    const iptu = int(p.valor_iptu);
    const livingArea = int(p.area_util);
    const lotArea = int(p.area_total);
    const bedrooms = int(p.dormitorios);
    const suites = int(p.suites);
    const bathrooms = int(p.banheiros);
    const garage = int(p.vagas);

    const address = [
      `<Country abbreviation="BR">Brasil</Country>`,
      `<State abbreviation="${xml(p.estado ?? 'SP')}">${cdata(p.estado ?? 'São Paulo')}</State>`,
      `<City>${cdata(p.cidade)}</City>`,
      `<Neighborhood>${cdata(p.bairro)}</Neighborhood>`,
      p.endereco ? `<Address>${cdata(p.endereco)}</Address>` : '',
      p.numero ? `<StreetNumber>${cdata(p.numero)}</StreetNumber>` : '',
      p.complemento ? `<Complement>${cdata(p.complemento)}</Complement>` : '',
      p.cep ? `<PostalCode>${xml(p.cep)}</PostalCode>` : '',
    ].join('');

    const details = [
      `<PropertyType>${xml(type)}</PropertyType>`,
      `<UsageType>${xml(usage)}</UsageType>`,
      price !== null ? `<ListPrice currency="BRL">${price}</ListPrice>` : '',
      condo !== null ? `<PropertyAdministrationFee currency="BRL">${condo}</PropertyAdministrationFee>` : '',
      iptu !== null ? `<Iptu currency="BRL" period="Yearly">${iptu}</Iptu>` : '',
      `<Description>${cdata(normalizeDescription(p.descricao))}</Description>`,
      livingArea !== null ? `<LivingArea unit="square metres">${livingArea}</LivingArea>` : '',
      lotArea !== null ? `<LotArea unit="square metres">${lotArea}</LotArea>` : '',
      bedrooms !== null ? `<Bedrooms>${bedrooms}</Bedrooms>` : '',
      suites !== null ? `<Suites>${suites}</Suites>` : '',
      bathrooms !== null ? `<Bathrooms>${bathrooms}</Bathrooms>` : '',
      garage !== null ? `<Garage>${garage}</Garage>` : '',
      p.ano_construcao ? `<YearBuilt>${int(p.ano_construcao)}</YearBuilt>` : '',
      Array.isArray(p.caracteristicas)
        ? `<Features>${p.caracteristicas.map((f: string) => `<Feature>${cdata(f)}</Feature>`).join('')}</Features>`
        : '',
    ].join('');

    if (propertyImages.length < 5) return '';

    const media = propertyImages
      .map((i, index) => {
        const primary = i.principal || (index === 0 && !propertyImages.some((x) => x.principal));
        return `<Item medium="image" caption="${xml(`img${index + 1}`)}"${primary ? ' primary="true"' : ''}>${xml(fotoUrl(i.path))}</Item>`;
      })
      .join('');

    const detailUrl = `${process.env.NTALPHA_SITE_BASE_URL ?? 'https://www.ntalpha.com.br'}/imoveis/${encodeURIComponent(p.codigo ?? p.id)}`;

    return `<Listing>
      <ListingID>${xml(p.codigo ?? p.id)}</ListingID>
      <Title>${cdata(p.titulo)}</Title>
      <TransactionType>For Sale</TransactionType>
      <PublicationType>${p.destaque ? 'PREMIUM' : 'STANDARD'}</PublicationType>
      <DetailViewUrl>${xml(detailUrl)}</DetailViewUrl>
      <Details>${details}</Details>
      <Location displayAddress="${displayAddress(p.exibir_endereco)}">${address}</Location>
      <Media>${media}</Media>
      <ContactInfo>
        <Name>${cdata(process.env.NTALPHA_PUBLIC_NAME ?? 'NT ALPHA Imóveis')}</Name>
        <Email>${xml(process.env.NTALPHA_PUBLIC_EMAIL ?? '')}</Email>
        <Website>${xml(process.env.NTALPHA_SITE_BASE_URL ?? 'https://www.ntalpha.com.br')}</Website>
        <Telephone>${xml(process.env.NTALPHA_PUBLIC_PHONE ?? '')}</Telephone>
      </ContactInfo>
    </Listing>`;
  }).join('');

  const publishDate = new Date().toISOString().replace(/\\.\\d{3}Z$/, '');
  const document = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
 <Header>
  <Provider>${cdata('NT ALPHA Integrador Próprio')}</Provider>
  <Email>${xml(process.env.NTALPHA_PUBLIC_EMAIL ?? '')}</Email>
  <ContactName>${cdata(process.env.NTALPHA_PUBLIC_NAME ?? 'NT ALPHA Imóveis')}</ContactName>
  <PublishDate>${publishDate}</PublishDate>
  <Telephone>${xml(process.env.NTALPHA_PUBLIC_PHONE ?? '')}</Telephone>
 </Header>
 <Listings>${xmlListings}</Listings>
</ListingDataFeed>`;

  return new NextResponse(document, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
