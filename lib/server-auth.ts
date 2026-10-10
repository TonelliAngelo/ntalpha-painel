import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from '@/lib/server-env';

export const ADMIN_ROLES = ['RAFAEL', 'NIVALDO', 'ADMIN'] as const;

export async function requireAdmin(request: NextRequest) {
  const config = await getServerSupabaseConfig();
  if (!config.url || !config.publishableKey || !config.secretKey) {
    return { ok: false as const, status: 500, error: 'Configuração do servidor incompleta.' };
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false as const, status: 401, error: 'Sessão não encontrada.' };
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return { ok: false as const, status: 401, error: 'Sessão não encontrada.' };
  }

  const userClient = createClient(config.url, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Sessão inválida.' };
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role,nome')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || !ADMIN_ROLES.includes(String(profile.role).toUpperCase() as typeof ADMIN_ROLES[number])) {
    return { ok: false as const, status: 403, error: 'Sem permissão administrativa.' };
  }

  const admin = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return { ok: true as const, config, admin, user, profile };
}
