import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta.' },
        { status: 500 }
      );
    }

    // Token do usuário que está solicitando a alteração.
    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Sessão não encontrada.' },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);

    // Cliente comum: usado somente para validar quem está logado.
    const authClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
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

    // Confere o perfil do usuário autenticado.
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

    // Somente Rafael e Nivaldo podem administrar senhas.
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

    // Cliente administrativo.
    // A Secret Key existe apenas no servidor.
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Confirma que o usuário de destino existe.
    const { data: targetUser, error: targetError } =
      await adminClient.auth.admin.getUserById(userId);

    if (targetError || !targetUser?.user) {
      return NextResponse.json(
        { error: 'Usuário que terá a senha alterada não foi localizado.' },
        { status: 404 }
      );
    }

    // Altera somente a senha.
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
