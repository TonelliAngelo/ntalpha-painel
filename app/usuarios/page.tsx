'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type Usuario = {
  id: string;
  nome: string;
  role: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
};

export default function UsuariosPage() {
  const client = useMemo(() => supabase(), []);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarUsuarios() {
      setLoading(true);
      setErro('');

      const { data, error } = await client.rpc('list_panel_users');

      if (error) {
        console.error('Erro ao carregar usuários:', error);
        setErro('Não foi possível carregar os usuários.');
        setLoading(false);
        return;
      }

      setUsuarios((data ?? []) as Usuario[]);
      setLoading(false);
    }

    carregarUsuarios();
  }, [client]);

  function formatarData(data: string | null) {
    if (!data) return 'Nunca acessou';

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(data));
  }

  return (
    <div className="shell">
      <Nav />

      <main className="content">
        <header>
          <div>
            <span className="eyebrow">ADMINISTRAÇÃO NT ALPHA</span>
            <h1>Usuários</h1>
          </div>
        </header>

        <section className="panel">
          <h2>Usuários do painel</h2>

          <p>
            Gerencie os usuários autorizados a acessar o Painel NT ALPHA.
          </p>

          {loading && (
            <div className="empty">
              <strong>Carregando usuários...</strong>
            </div>
          )}

          {!loading && erro && (
            <div className="status">
              <strong>{erro}</strong>
            </div>
          )}

          {!loading && !erro && usuarios.length === 0 && (
            <div className="empty">
              <strong>Nenhum usuário localizado.</strong>
            </div>
          )}

          {!loading && !erro && usuarios.length > 0 && (
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Último acesso</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>
                        <strong>{usuario.nome}</strong>
                      </td>

                      <td>{usuario.email}</td>

                      <td>
                        <span className="role-badge">
                          {usuario.role}
                        </span>
                      </td>

                      <td>
                        {formatarData(usuario.last_sign_in_at)}
                      </td>

                      <td>
                        <button
                          className="user-action"
                          type="button"
                          disabled
                          title="Será habilitado na próxima etapa"
                        >
                          Redefinir senha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}