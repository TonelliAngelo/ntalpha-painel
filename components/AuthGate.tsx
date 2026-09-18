'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const client = useMemo(() => supabase(), []);
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function validarUsuario() {
      setLiberado(false);

      const {
        data: { user },
      } = await client.auth.getUser();

      if (!ativo) return;

      const paginaLogin = pathname === '/login';

      // Sem autenticação tentando acessar o painel
      if (!user && !paginaLogin) {
        router.replace('/login');
        return;
      }

      // Usuário autenticado tentando voltar para o login
      if (user && paginaLogin) {
        router.replace('/');
        return;
      }

      setLiberado(true);
    }

    validarUsuario();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const paginaLogin = pathname === '/login';

      if (!session && !paginaLogin) {
        setLiberado(false);
        router.replace('/login');
        return;
      }

      if (session && paginaLogin) {
        setLiberado(false);
        router.replace('/');
        return;
      }

      setLiberado(true);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, [client, pathname, router]);

  if (!liberado) {
    return (
      <main className="login">
        <div className="login-card">
          <div className="brand center">
            NT <b>ALPHA</b>
            <small>PAINEL IMOBILIÁRIO</small>
          </div>

          <p>Carregando painel...</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
