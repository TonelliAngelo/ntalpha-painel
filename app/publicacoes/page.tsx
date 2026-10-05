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

  const [usuarioSelecionado, setUsuarioSelecionado] =
    useState<Usuario | null>(null);

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroSenha, setErroSenha] = useState('');

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

  function abrirReset(usuario: Usuario) {
    setUsuarioSelecionado(usuario);
    setNovaSenha('');
    setConfirmarSenha('');
    setErroSenha('');
    setMensagem('');
  }

  function fecharReset() {
    if (processando) return;

    setUsuarioSelecionado(null);
    setNovaSenha('');
    setConfirmarSenha('');
    setErroSenha('');
  }

  async function redefinirSenha() {
    if (!usuarioSelecionado) return;

    setErroSenha('');
    setMensagem('');

    if (novaSenha.length < 8) {
      setErroSenha('A nova senha deve possuir pelo menos 8 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErroSenha('As senhas informadas não são iguais.');
      return;
    }

    const confirmar = window.confirm(
      `Confirma a redefinição da senha de ${usuarioSelecionado.nome}?`
    );

    if (!confirmar) return;

    setProcessando(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();

      if (sessionError || !session?.access_token) {
        setErroSenha(
          'Sua sessão expirou. Saia do painel e entre novamente.'
        );
        setProcessando(false);
        return;
      }

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: usuarioSelecionado.id,
          novaSenha,
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        setErroSenha(
          resultado?.error || 'Não foi possível redefinir a senha.'
        );
        setProcessando(false);
        return;
      }

      setMensagem(
        `Senha de ${usuarioSelecionado.nome} redefinida com sucesso.`
      );

      setNovaSenha('');
      setConfirmarSenha('');
      setUsuarioSelecionado(null);
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      setErroSenha(
        'Não foi possível comunicar com o servidor. Tente novamente.'
      );
    } finally {
      setProcessando(false);
    }
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

        {mensagem && (
          <div className="success-message">
            <strong>{mensagem}</strong>
          </div>
        )}

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

                      <td>{formatarData(usuario.last_sign_in_at)}</td>

                      <td>
                        <button
                          className="user-action"
                          type="button"
                          onClick={() => abrirReset(usuario)}
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

        {usuarioSelecionado && (
          <div
            className="password-modal-backdrop"
            onClick={fecharReset}
          >
            <div
              className="password-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="eyebrow">
                ADMINISTRAÇÃO DE USUÁRIO
              </span>

              <h2>Redefinir senha</h2>

              <p>
                Usuário:{' '}
                <strong>{usuarioSelecionado.nome}</strong>
              </p>

              <p className="password-user-email">
                {usuarioSelecionado.email}
              </p>

              <label>
                Nova senha
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(event) =>
                    setNovaSenha(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  disabled={processando}
                />
              </label>

              <label>
                Confirmar nova senha
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(event) =>
                    setConfirmarSenha(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Digite novamente a senha"
                  disabled={processando}
                />
              </label>

              {erroSenha && (
                <div className="password-error">
                  {erroSenha}
                </div>
              )}

              <div className="password-modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={fecharReset}
                  disabled={processando}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="button"
                  onClick={redefinirSenha}
                  disabled={processando}
                >
                  {processando
                    ? 'Redefinindo...'
                    : 'Redefinir senha'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
