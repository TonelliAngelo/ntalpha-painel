import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUCKET = 'property-images';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const propertyId = String(body.propertyId ?? '').trim();
    if (!propertyId) return NextResponse.json({ error: 'propertyId é obrigatório.' }, { status: 400 });

    const { data: property, error: propertyError } = await auth.admin
      .from('properties')
      .select('id,codigo,titulo')
      .eq('id', propertyId)
      .maybeSingle();

    if (propertyError) return NextResponse.json({ error: propertyError.message }, { status: 500 });
    if (!property) return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 });

    const { data: activePubs, error: pubError } = await auth.admin
      .from('property_publications')
      .select('id,channel,enabled')
      .eq('property_id', propertyId)
      .eq('enabled', true);

    if (pubError) return NextResponse.json({ error: pubError.message }, { status: 500 });
    if ((activePubs ?? []).length) {
      return NextResponse.json(
        { error: 'Desative todos os canais de publicação antes de excluir o imóvel.', channels: activePubs?.map((p) => p.channel) ?? [] },
        { status: 409 }
      );
    }

    const { data: media, error: mediaError } = await auth.admin
      .from('property_images')
      .select('id,path')
      .eq('property_id', propertyId);

    if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });

    const paths = (media ?? []).map((m) => m.path).filter(Boolean);

    // Primeiro removemos o registro do imóvel. O banco deve limpar os filhos por FK/cascade.
    // O Storage é limpo em seguida, sempre com a lista capturada antes da exclusão.
    const { error: deleteError } = await auth.admin
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Não foi possível excluir o imóvel no banco: ${deleteError.message}` },
        { status: 409 }
      );
    }

    let storageError: string | null = null;
    if (paths.length) {
      // Supabase Storage remove aceita lotes; mantemos lotes pequenos para evitar payload excessivo.
      for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);
        const result = await auth.admin.storage.from(BUCKET).remove(batch);
        if (result.error) storageError = result.error.message;
      }
    }

    if (storageError) {
      return NextResponse.json(
        {
          ok: false,
          partial: true,
          error: `Imóvel excluído do banco, mas houve falha na limpeza do Storage: ${storageError}`,
          propertyId,
          pathsPendingCleanup: paths,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, propertyId, codigo: property.codigo, titulo: property.titulo, mediaRemoved: paths.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir imóvel.' },
      { status: 500 }
    );
  }
}
