import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from '@/lib/server-env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const config = await getServerSupabaseConfig();

    if (!config.url || !config.publishableKey || !config.secretKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta.' },
        { status: 500 }
      );
    }

    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Sessão não encontrada.' },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);

    const authClient = createClient(config.url, config.publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select('nome, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil do usuário não localizado.' },
        { status: 403 }
      );
    }

    const administradores = ['RAFAEL', 'NIVALDO'];

    if (!administradores.includes(String(profile.role).toUpperCase())) {
      return NextResponse.json(
        { error: 'Você não possui permissão para redefinir senhas.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const userId =
      typeof body?.userId === 'string' ? body.userId.trim() : '';

    const novaSenha =
      typeof body?.novaSenha === 'string' ? body.novaSenha : '';

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não informado.' },
        { status: 400 }
      );
    }

    if (novaSenha.length < 8) {
      return NextResponse.json(
        { error: 'A nova senha deve possuir pelo menos 8 caracteres.' },
        { status: 400 }
      );
    }

    if (novaSenha.length > 72) {
      return NextResponse.json(
        { error: 'A senha informada é muito longa.' },
        { status: 400 }
      );
    }

    const adminClient = createClient(config.url, config.secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: targetUser, error: targetError } =
      await adminClient.auth.admin.getUserById(userId);

    if (targetError || !targetUser?.user) {
      return NextResponse.json(
        { error: 'Usuário que terá a senha alterada não foi localizado.' },
        { status: 404 }
      );
    }

    const { error: updateError } =
      await adminClient.auth.admin.updateUserById(userId, {
        password: novaSenha,
      });

    if (updateError) {
      console.error('Erro ao redefinir senha:', updateError.message);
      return NextResponse.json(
        { error: 'Não foi possível redefinir a senha.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso.',
    });
  } catch (error) {
    console.error('Erro na API reset-password:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar a solicitação.' },
      { status: 500 }
    );
  }
}
