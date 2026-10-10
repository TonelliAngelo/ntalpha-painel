import { NextResponse } from 'next/server';
import {
  getServerSupabaseConfig,
  hasServerSupabaseConfig,
} from '@/lib/server-env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const config = await getServerSupabaseConfig();
  const found = hasServerSupabaseConfig(config);

  return NextResponse.json({
    ok: found.url && found.secretKey,
    service: 'ntalpha-integrador',
    configured: found.url && found.secretKey,
    found,
    accepted_server_keys: [
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY (legado)',
    ],
    feeds: {
      olx: '/api/integracao/olx',
      zap: '/api/integracao/vrsync?channel=zap',
      vivareal: '/api/integracao/vrsync?channel=vivareal',
    },
    timestamp: new Date().toISOString(),
  });
}
