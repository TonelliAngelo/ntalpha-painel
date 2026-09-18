'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoggedUser from '@/components/LoggedUser';

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  async function sair() {
    await supabase().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  function ativo(path: string) {
    if (path === '/') {
      return pathname === '/';
    }

    return pathname.startsWith(path);
  }

  return (
    <aside>
      <div className="panel-logo">
        <Image
          src="/images/ntalpha-logo-footer.png"
          alt="NT ALPHA Imóveis"
          width={180}
          height={112}
          priority
        />
      </div>

      <nav>
        <Link className={ativo('/') ? 'active' : ''} href="/">
          Dashboard
        </Link>

        <Link className={ativo('/imoveis') ? 'active' : ''} href="/imoveis">
          Imóveis
        </Link>

        <Link className={ativo('/clientes') ? 'active' : ''} href="/clientes">
          Clientes
        </Link>

        <Link
          className={ativo('/condominios') ? 'active' : ''}
          href="/condominios"
        >
          Condomínios
        </Link>

        <Link className={ativo('/contatos') ? 'active' : ''} href="/contatos">
          Contatos
        </Link>

        <Link className="new-property-link" href="/imoveis/novo">
          + Novo imóvel
        </Link>
      </nav>

      <div className="nav-bottom">
        <LoggedUser />

        <button className="ghost" onClick={sair}>
          Sair
        </button>
      </div>
    </aside>
  );
}
