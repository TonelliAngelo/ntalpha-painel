'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type C = {
  id: string;
  nome: string;
  cep: string | null;
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  observacoes: string | null;
};

const vazio = {
  nome: '',
  cep: '',
  cidade: '',
  bairro: '',
  endereco: '',
  observacoes: '',
};

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

export default function Page() {
  const db = useMemo(() => supabase(), []);
  const [rows, setRows] = useState<C[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState(vazio);
  const [view, setView] = useState<C | null>(null);
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [loadingImoveis, setLoadingImoveis] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  async function load() {
    const { data } = await db
      .from('condominiums')
      .select('*')
      .order('created_at', { ascending: false });

    setRows((data ?? []) as C[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function novo() {
    setView(null);
    setF(vazio);
    setEditId(null);
    setMsg('');
    setOpen(true);
  }

  async function buscarCep() {
    const digits = f.cep.replace(/\D/g, '');

    if (digits.length !== 8) {
      setMsg('Informe um CEP válido com 8 dígitos.');
      return;
    }

    setCepLoading(true);
    setMsg('Consultando CEP...');

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${digits}/json/`
      );

      if (!response.ok) {
        throw new Error('Falha ao consultar o CEP.');
      }

      const data = await response.json();

      if (data.erro) {
        setMsg('CEP não encontrado.');
        return;
      }

      setF((current) => ({
        ...current,
        cep: formatCep(data.cep ?? f.cep),
        cidade: data.localidade ?? current.cidade,
        bairro: data.bairro ?? current.bairro,
        endereco: data.logradouro ?? current.endereco,
      }));

      setMsg(
        'Endereço preenchido automaticamente. Confira os dados antes de salvar.'
      );
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o CEP.'
      );
    } finally {
      setCepLoading(false);
    }
  }

  async function visualizar(c: C) {
    setOpen(false);
    setView(c);
    setLoadingImoveis(true);

    const { data } = await db
      .from('properties')
      .select(
        'id,codigo,titulo,tipo,bairro,cidade,valor,status,publicar_site'
      )
      .eq('condominium_id', c.id)
      .order('created_at', { ascending: false });

    setImoveis(data ?? []);
    setLoadingImoveis(false);
  }

  function editar(c: C) {
    setView(null);
    setF({
      nome: c.nome ?? '',
      cep: c.cep ? formatCep(c.cep) : '',
      cidade: c.cidade ?? '',
      bairro: c.bairro ?? '',
      endereco: c.endereco ?? '',
      observacoes: c.observacoes ?? '',
    });
    setEditId(c.id);
    setMsg('');
    setOpen(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();

    const payload = {
      nome: f.nome.trim(),
      cep: f.cep.replace(/\D/g, '') || null,
      cidade: f.cidade.trim() || null,
      bairro: f.bairro.trim() || null,
      endereco: f.endereco.trim() || null,
      observacoes: f.observacoes.trim() || null,
    };

    if (!payload.nome) {
      setMsg('Informe o nome do condomínio.');
      return;
    }

    const q = editId
      ? db.from('condominiums').update(payload).eq('id', editId)
      : db.from('condominiums').insert(payload);

    const { error } = await q;

    if (error) {
      setMsg('Não foi possível salvar: ' + error.message);
      return;
    }

    setOpen(false);
    setMsg(editId ? 'Condomínio atualizado.' : 'Condomínio cadastrado.');
    await load();
  }

  async function excluir(c: C) {
    if (!confirm(`Excluir o condomínio ${c.nome}?`)) return;

    const { error } = await db
      .from('condominiums')
      .delete()
      .eq('id', c.id);

    if (error) {
      setMsg(
        'Não foi possível excluir. O condomínio pode estar associado a imóveis.'
      );
      return;
    }

    setMsg('Condomínio excluído.');
    await load();
  }

  return (
    <div className="shell">
      <Nav />

      <main className="content">
        <header>
          <div>
            <span className="eyebrow">GESTÃO NT ALPHA</span>
            <h1>Condomínios</h1>
            <p className="page-intro">
              Base de condomínios para associação aos imóveis.
            </p>
          </div>

          <button onClick={novo}>+ Novo condomínio</button>
        </header>

        {open && (
          <section className="panel form quick-form">
            <h2>{editId ? 'Editar condomínio' : 'Cadastro de condomínio'}</h2>

            <form onSubmit={salvar}>
              <div className="grid">
                <label>
                  Nome *
                  <input
                    required
                    value={f.nome}
                    onChange={(e) =>
                      setF({ ...f, nome: e.target.value })
                    }
                  />
                </label>

                <label>
                  CEP
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-end',
                    }}
                  >
                    <input
                      value={f.cep}
                      onChange={(e) =>
                        setF({
                          ...f,
                          cep: formatCep(e.target.value),
                        })
                      }
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={cepLoading}
                      onClick={buscarCep}
                    >
                      {cepLoading ? 'Consultando...' : 'Buscar endereço'}
                    </button>
                  </div>
                </label>

                <label>
                  Cidade
                  <input
                    value={f.cidade}
                    onChange={(e) =>
                      setF({ ...f, cidade: e.target.value })
                    }
                  />
                </label>

                <label>
                  Bairro
                  <input
                    value={f.bairro}
                    onChange={(e) =>
                      setF({ ...f, bairro: e.target.value })
                    }
                  />
                </label>

                <label>
                  Endereço
                  <input
                    value={f.endereco}
                    onChange={(e) =>
                      setF({ ...f, endereco: e.target.value })
                    }
                  />
                </label>
              </div>

              <label>
                Observações
                <textarea
                  rows={3}
                  value={f.observacoes}
                  onChange={(e) =>
                    setF({
                      ...f,
                      observacoes: e.target.value,
                    })
                  }
                />
              </label>

              <div className="actions">
                <button>Salvar</button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

        {view && (
          <section className="panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span className="eyebrow">CADASTRO DO CONDOMÍNIO</span>
                <h2 style={{ marginBottom: 4 }}>{view.nome}</h2>
                <p className="page-intro" style={{ margin: 0 }}>
                  Visualização somente leitura.
                </p>
              </div>

              <div className="actions">
                <button onClick={() => editar(view)}>
                  Editar cadastro
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setView(null)}
                >
                  ← Voltar para condomínios
                </button>
              </div>
            </div>

            <div className="grid" style={{ marginTop: 22 }}>
              <div>
                <small>CEP</small>
                <br />
                <strong>{view.cep ? formatCep(view.cep) : '—'}</strong>
              </div>

              <div>
                <small>Cidade</small>
                <br />
                <strong>{view.cidade || '—'}</strong>
              </div>

              <div>
                <small>Bairro</small>
                <br />
                <strong>{view.bairro || '—'}</strong>
              </div>

              <div>
                <small>Endereço</small>
                <br />
                <strong>{view.endereco || '—'}</strong>
              </div>
            </div>

            {view.observacoes && (
              <div style={{ marginTop: 18 }}>
                <small>Observações</small>
                <p>{view.observacoes}</p>
              </div>
            )}

            <section
              style={{
                marginTop: 28,
                paddingTop: 24,
                borderTop: '1px solid #e5d8bd',
              }}
            >
              <span className="eyebrow">CARTEIRA DO CONDOMÍNIO</span>
              <h2 style={{ marginBottom: 4 }}>Imóveis vinculados</h2>
              <p className="page-intro" style={{ marginTop: 0 }}>
                Imóveis cadastrados atualmente neste condomínio.
              </p>

              {loadingImoveis ? (
                <div className="empty">
                  <strong>Carregando imóveis...</strong>
                </div>
              ) : imoveis.length === 0 ? (
                <div className="empty">
                  <strong>
                    Nenhum imóvel vinculado a este condomínio.
                  </strong>
                </div>
              ) : (
                <div className="data-list">
                  {imoveis.map((i: any) => (
                    <article
                      className="data-card crud-card"
                      key={i.id}
                    >
                      <div>
                        <strong>
                          {i.codigo} — {i.titulo}
                        </strong>
                        <span>
                          {[i.tipo, i.bairro, i.cidade]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>

                      <div>
                        <small>Valor</small>
                        <b>
                          {i.valor == null
                            ? '—'
                            : new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                maximumFractionDigits: 0,
                              }).format(i.valor)}
                        </b>
                      </div>

                      <div>
                        <small>Status</small>
                        <b>{i.status || '—'}</b>
                      </div>

                      <div>
                        <small>Site</small>
                        <b>
                          {i.publicar_site
                            ? 'Publicado'
                            : 'Não publicado'}
                        </b>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}

        {msg && <div className="status">{msg}</div>}

        <section className="panel">
          {rows.length === 0 ? (
            <div className="empty">
              <strong>Nenhum condomínio encontrado.</strong>
            </div>
          ) : (
            <div className="data-list">
              {rows.map((c) => (
                <article
                  className="data-card crud-card"
                  key={c.id}
                >
                  <div>
                    <strong>{c.nome}</strong>
                    <span>
                      {c.bairro || '—'} · {c.cidade || '—'}
                    </span>
                  </div>

                  <div>
                    <small>CEP</small>
                    <b>{c.cep ? formatCep(c.cep) : '—'}</b>
                  </div>

                  <div>
                    <small>Endereço</small>
                    <b>{c.endereco || '—'}</b>
                  </div>

                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      onClick={() => visualizar(c)}
                    >
                      Visualizar
                    </button>
                    <button onClick={() => editar(c)}>
                      Editar
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => excluir(c)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
