import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Env = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type Publication = {
  property_id: string | number;
  channel: string;
  enabled: boolean;
};

type PropertyImage = {
  property_id: string | number;
  path: string | null;
  tipo: string | null;
  principal: boolean | null;
  ordem: number | null;
};

export async function GET() {
  /*
   * Cloudflare / OpenNext:
   * As variáveis de produção são lidas do binding env do Worker.
   * Não coloque chaves diretamente neste arquivo.
   */
  let env: Env = {};

  try {
    const context = await getCloudflareContext({ async: true });
    env = (context?.env ?? {}) as Env;
  } catch {
    // Fallback para execução local/ambiente Node.
    env = {};
  }

  const url =
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    '';

  const key =
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    '';

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Supabase de servidor não configurado.',
        required: [
          'NEXT_PUBLIC_SUPABASE_URL',
          'SUPABASE_SERVICE_ROLE_KEY'
        ],
        found: {
          NEXT_PUBLIC_SUPABASE_URL: Boolean(url),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(key)
        }
      },
      { status: 500 }
    );
  }

  const db = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: pubs, error: pe } = await db
    .from('property_publications')
    .select('property_id,channel,enabled')
    .in('channel', ['olx', 'zap', 'vivareal']);

  if (pe) {
    return NextResponse.json(
      { ok: false, error: pe.message },
      { status: 500 }
    );
  }

  const ids = [
    ...new Set(
      ((pubs ?? []) as Publication[])
        .filter((p) => p.enabled)
        .map((p) => p.property_id)
    )
  ];

  if (!ids.length) {
    return NextResponse.json({
      ok: true,
      total: 0,
      validos: 0,
      invalidos: 0,
      pendencias: [],
      feed: '/api/integracao/vrsync'
    });
  }

  const { data: props, error: xe } = await db
    .from('properties')
    .select(
      'id,codigo,titulo,tipo,status,cep,cidade,bairro,valor,area_util,descricao'
    )
    .in('id', ids);

  if (xe) {
    return NextResponse.json(
      { ok: false, error: xe.message },
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
      { ok: false, error: ie.message },
      { status: 500 }
    );
  }

  const publicationsByProperty = new Map<string | number, string[]>();

  for (const pub of (pubs ?? []) as Publication[]) {
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

    if (!p.titulo || p.titulo.length < 10 || p.titulo.length > 100) {
      issues.push('título deve ter entre 10 e 100 caracteres');
    }

    if (!p.cep) {
      issues.push('CEP ausente');
    }

    if (!p.cidade) {
      issues.push('cidade ausente');
    }

    if (!p.bairro) {
      issues.push('bairro ausente');
    }

    if (
      !p.descricao ||
      p.descricao.replace(/<[^>]*>/g, ' ').trim().length < 50
    ) {
      issues.push('descrição com menos de 50 caracteres');
    }

    if (
      p.area_util == null &&
      !/terreno|lote|galpão|galpao|depósito|deposito|armazém|armazem/i.test(
        p.tipo ?? ''
      )
    ) {
      issues.push('área útil ausente');
    }

    if (propertyImages.length < 5) {
      issues.push(
        `apenas ${propertyImages.length} fotos JPG/JPEG; o portal exige no mínimo 5`
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
      issues
    };
  });

  const validos = pendencias.filter((x) => x.valid).length;

  return NextResponse.json({
    ok: true,
    total: pendencias.length,
    validos,
    invalidos: pendencias.length - validos,
    pendencias,
    feed: '/api/integracao/vrsync'
  });
}
