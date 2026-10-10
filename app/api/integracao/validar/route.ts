import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from '@/lib/server-env';
import { NT_ALPHA_PUBLICATION_RULES } from '@/lib/publication-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Publication = {
  property_id: string;
  channel: string;
  enabled: boolean;
};

type PropertyImage = {
  property_id: string;
  path: string | null;
  tipo: string | null;
  principal: boolean | null;
  ordem: number | null;
};

export async function GET() {
  const config = await getServerSupabaseConfig();

  if (!config.url || !config.secretKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Supabase de servidor não configurado.',
        required: [
          'NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)',
          'SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY legado)',
        ],
        found: {
          NEXT_PUBLIC_SUPABASE_URL: Boolean(config.url),
          SUPABASE_SERVER_KEY: Boolean(config.secretKey),
        },
      },
      { status: 500 }
    );
  }

  const db = createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data: pubs, error: pe } = await db
    .from('property_publications')
    .select('property_id,channel,enabled')
    .in('channel', ['olx', 'zap', 'vivareal']);

  if (pe) {
    return NextResponse.json(
      { ok: false, etapa: 'property_publications', error: pe.message },
      { status: 500 }
    );
  }

  const enabledPubs = (pubs ?? []) as Publication[];
  const ids = [
    ...new Set(
      enabledPubs
        .filter((p) => p.enabled)
        .map((p) => p.property_id)
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    return NextResponse.json({
      ok: true,
      total: 0,
      validos: 0,
      invalidos: 0,
      pendencias: [],
      feeds: {
        olx: '/api/integracao/olx',
        zap: '/api/integracao/vrsync?channel=zap',
        vivareal: '/api/integracao/vrsync?channel=vivareal',
      },
    });
  }

  const { data: props, error: xe } = await db
    .from('properties')
    .select(
      'id,codigo,titulo,tipo,status,cep,cidade,bairro,valor,area_util,area_total,descricao'
    )
    .in('id', ids);

  if (xe) {
    return NextResponse.json(
      { ok: false, etapa: 'properties', error: xe.message },
      { status: 500 }
    );
  }

  const { data: imgs, error: ie } = await db
    .from('property_images')
    .select('property_id,path,tipo,principal,ordem')
    .in('property_id', ids)
    .eq('tipo', 'foto');

  if (ie) {
    return NextResponse.json(
      { ok: false, etapa: 'property_images', error: ie.message },
      { status: 500 }
    );
  }

  const publicationsByProperty = new Map<string, string[]>();

  for (const pub of enabledPubs) {
    if (!pub.enabled) continue;
    const current = publicationsByProperty.get(pub.property_id) ?? [];
    current.push(pub.channel);
    publicationsByProperty.set(pub.property_id, current);
  }

  const pendencias = (props ?? []).map((p) => {
    const propertyImages = ((imgs ?? []) as PropertyImage[]).filter(
      (i) =>
        i.property_id === p.id &&
        /\.(jpe?g)$/i.test(i.path ?? '')
    );

    const issues: string[] = [];

    if (p.status !== 'disponivel') {
      issues.push('imóvel não está disponível');
    }

    if (!p.codigo) {
      issues.push('código do imóvel ausente');
    }

    if (!p.titulo || p.titulo.trim().length < 10 || p.titulo.trim().length > 100) {
      issues.push('título deve ter entre 10 e 100 caracteres');
    }

    if (!p.cep) issues.push('CEP ausente');
    if (!p.cidade) issues.push('cidade ausente');
    if (!p.bairro) issues.push('bairro ausente');

    if (
      !p.descricao ||
      p.descricao.replace(/<[^>]*>/g, ' ').trim().length < 50
    ) {
      issues.push('descrição com menos de 50 caracteres');
    }

    const isLand = /terreno|lote/i.test(p.tipo ?? '');
    if (!isLand && p.area_util == null) {
      issues.push('área útil ausente');
    }
    if (isLand && p.area_total == null) {
      issues.push('área total do terreno ausente');
    }

    if (propertyImages.length < NT_ALPHA_PUBLICATION_RULES.minFeedPhotos) {
      issues.push(
        `apenas ${propertyImages.length} fotos JPG/JPEG; o feed exige no mínimo ${NT_ALPHA_PUBLICATION_RULES.minFeedPhotos}`
      );
    }

    if (
      !propertyImages.some(
        (i) => i.principal && /\.(jpe?g)$/i.test(i.path ?? '')
      )
    ) {
      issues.push('não há foto JPG/JPEG definida como capa');
    }

    return {
      codigo: p.codigo,
      titulo: p.titulo,
      property_id: p.id,
      canais: publicationsByProperty.get(p.id) ?? [],
      valid: issues.length === 0,
      issues,
    };
  });

  const validos = pendencias.filter((x) => x.valid).length;

  return NextResponse.json({
    ok: true,
    total: pendencias.length,
    validos,
    invalidos: pendencias.length - validos,
    pendencias,
    feeds: {
      olx: '/api/integracao/olx',
      zap: '/api/integracao/vrsync?channel=zap',
      vivareal: '/api/integracao/vrsync?channel=vivareal',
    },
  });
}
