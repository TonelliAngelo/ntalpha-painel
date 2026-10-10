import { getCloudflareContext } from '@opennextjs/cloudflare';

type RuntimeEnv = Record<string, unknown>;

export type ServerSupabaseConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

function value(env: RuntimeEnv, ...names: string[]) {
  for (const name of names) {
    const runtime = env[name];
    if (typeof runtime === 'string' && runtime.trim()) {
      return runtime.trim();
    }

    const local = process.env[name];
    if (typeof local === 'string' && local.trim()) {
      return local.trim();
    }
  }

  return '';
}

export async function getServerSupabaseConfig(): Promise<ServerSupabaseConfig> {
  let env: RuntimeEnv = {};

  try {
    const context = await getCloudflareContext({ async: true });
    env = (context?.env ?? {}) as RuntimeEnv;
  } catch {
    // Next.js local development may not expose Cloudflare bindings.
  }

  return {
    // Accept both the names already used by the project and the
    // shorter SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY aliases.
    url: value(env, 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
    publishableKey: value(
      env,
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ),
    // Prefer the current Supabase Secret Key. Keep the legacy
    // service_role variable as a compatibility fallback during migration.
    secretKey: value(
      env,
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ),
  };
}

export function hasServerSupabaseConfig(config: ServerSupabaseConfig) {
  return {
    url: Boolean(config.url),
    publishableKey: Boolean(config.publishableKey),
    secretKey: Boolean(config.secretKey),
  };
}
