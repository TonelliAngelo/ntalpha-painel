import { getCloudflareContext } from '@opennextjs/cloudflare';

type RuntimeEnv = Record<string, unknown>;

export type ServerSupabaseConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function runtimeValue(env: RuntimeEnv, ...names: string[]): string {
  for (const name of names) {
    const value = clean(env[name]);
    if (value) return value;
  }
  return '';
}

export async function getServerSupabaseConfig(): Promise<ServerSupabaseConfig> {
  let env: RuntimeEnv = {};

  try {
    const context = await getCloudflareContext({ async: true });
    env = (context?.env ?? {}) as RuntimeEnv;
  } catch {
    // Local Next.js execution may not expose Cloudflare bindings.
  }

  /*
   * IMPORTANT:
   * NEXT_PUBLIC_* values are referenced statically below.
   * This allows Next.js/OpenNext to inject them during the build.
   * Runtime aliases are kept as fallbacks for Cloudflare Worker variables.
   */
  const url =
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    clean(process.env.SUPABASE_URL) ||
    runtimeValue(
      env,
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_URL'
    );

  const publishableKey =
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    clean(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    runtimeValue(
      env,
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );

  /*
   * Secret keys MUST remain runtime-only.
   * Never expose them through NEXT_PUBLIC_* variables.
   */
  const secretKey =
    runtimeValue(env, 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY') ||
    clean(process.env.SUPABASE_SECRET_KEY) ||
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    url,
    publishableKey,
    secretKey,
  };
}

export function hasServerSupabaseConfig(config: ServerSupabaseConfig) {
  return {
    url: Boolean(config.url),
    publishableKey: Boolean(config.publishableKey),
    secretKey: Boolean(config.secretKey),
  };
}
