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
    const mediaId = String(body.mediaId ?? '').trim();
    if (!mediaId) return NextResponse.json({ error: 'mediaId é obrigatório.' }, { status: 400 });

    const { data: media, error: mediaError } = await auth.admin
      .from('property_images')
      .select('id,property_id,path,tipo,principal')
      .eq('id', mediaId)
      .maybeSingle();

    if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });
    if (!media) return NextResponse.json({ error: 'Mídia não encontrada.' }, { status: 404 });

    if (media.principal) {
      const { count } = await auth.admin
        .from('property_images')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', media.property_id)
        .eq('tipo', 'foto')
        .neq('id', media.id);
      if ((count ?? 0) > 0) {
        // A capa pode ser removida, mas a exclusão não deve criar uma capa inválida.
        // O primeiro substituto será definido abaixo após a remoção.
      }
    }

    // Storage primeiro: se falhar, mantemos o registro para não esconder um arquivo que ainda existe.
    const storage = await auth.admin.storage.from(BUCKET).remove([media.path]);
    if (storage.error) {
      return NextResponse.json(
        { error: `Não foi possível remover o arquivo do Storage: ${storage.error.message}` },
        { status: 502 }
      );
    }

    const { error: deleteError } = await auth.admin
      .from('property_images')
      .delete()
      .eq('id', media.id);

    if (deleteError) {
      // Repetimos o DELETE do banco uma vez. O arquivo já foi removido do Storage; não criamos uma nova referência.
      const retry = await auth.admin.from('property_images').delete().eq('id', media.id);
      if (retry.error) {
        return NextResponse.json(
          { error: `Arquivo removido do Storage, mas o registro permaneceu no banco: ${retry.error.message}`, partial: true },
          { status: 500 }
        );
      }
    }

    if (media.tipo === 'foto' && media.principal) {
      const { data: nextPhoto } = await auth.admin
        .from('property_images')
        .select('id')
        .eq('property_id', media.property_id)
        .eq('tipo', 'foto')
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextPhoto) {
        await auth.admin.from('property_images').update({ principal: true }).eq('id', nextPhoto.id);
      }
    }

    return NextResponse.json({ ok: true, mediaId: media.id, path: media.path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover mídia.' },
      { status: 500 }
    );
  }
}
