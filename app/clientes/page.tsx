'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type C = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  observacoes: string | null;
  aceita_novidades: boolean;
};

type Imovel = {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string | null;
  bairro: string | null;
  cidade: string | null;
  valor: number | null;
  status: string | null;
};

const vazio = {
  nome: '',
  telefone: '',
  email: '',
  cpf: '',
  observacoes: '',
  aceita_novidades: true,
};

function dinheiro(v: number | null) {
  if (v == null) return 'Valor não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v);
}

export default function Page() {
  const db = useMemo(() => supabase(), []);
  const [rows, setRows] = useState<C[]>([]);
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState(vazio);

  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loadingImoveis, setLoadingImoveis] = useState(false);
  const [erroImoveis, setErroImoveis] = useState('');
  const [viewClient, setViewClient] = useState<C | null>(null);

  async function load() {
    const { data } = await db
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    setRows((data ?? []) as C[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function carregarImoveisDoCliente(clientId: string) {
    setLoadingImoveis(true);
    setErroImoveis('');
    setImoveis([]);

    const { data: vinculos, error: erroVinculos } = await db
      .from('property_owners')
      .select('property_id')
      .eq('client_id', clientId)
      .is('data_fim', null);

    if (erroVinculos) {
      setErroImoveis('Não foi possível consultar os imóveis vinculados.');
      setLoadingImoveis(false);
      return;
    }

    const ids = [...new Set((vinculos ?? []).map(v => v.property_id).filter(Boolean))];

    if (ids.length === 0) {
      setLoadingImoveis(false);
      return;
    }

    const { data: props, error: erroProps } = await db
      .from('properties')
      .select('id,codigo,titulo,tipo,bairro,cidade,valor,status')
      .in('id', ids)
      .order('codigo', { ascending: true });

    if (erroProps) {
      setErroImoveis('O vínculo existe, mas não foi possível carregar os dados dos imóveis.');
      setLoadingImoveis(false);
      return;
    }

    setImoveis((props ?? []) as Imovel[]);
    setLoadingImoveis(false);
  }

  function novo() {
    setViewClient(null);
    setF(vazio);
    setEditId(null);
    setImoveis([]);
    setErroImoveis('');
    setOpen(true);
  }

  function visualizar(c: C) {
    setF({
      nome: c.nome ?? '',
      telefone: c.telefone ?? '',
      email: c.email ?? '',
      cpf: c.cpf ?? '',
      observacoes: c.observacoes ?? '',
      aceita_novidades: !!c.aceita_novidades,
    });
    setEditId(null);
    setOpen(false);
    setViewClient(c);
    carregarImoveisDoCliente(c.id);
  }

  function editar(c: C) {
    setViewClient(null);
    setF({
      nome: c.nome ?? '',
      telefone: c.telefone ?? '',
      email: c.email ?? '',
      cpf: c.cpf ?? '',
      observacoes: c.observacoes ?? '',
      aceita_novidades: !!c.aceita_novidades,
    });
    setEditId(c.id);
    setOpen(true);
    carregarImoveisDoCliente(c.id);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();

    const payload = {
      ...f,
      nome: f.nome.trim(),
      telefone: f.telefone.trim(),
      email: f.email.trim() || null,
      cpf: f.cpf.replace(/\D/g, '') || null,
      observacoes: f.observacoes.trim() || null,
    };

    const q = editId
      ? db.from('clients').update(payload).eq('id', editId)
      : db.from('clients').insert(payload);

    const { error } = await q;

    if (error) return setMsg('Não foi possível salvar: ' + error.message);

    setOpen(false);
    setMsg(editId ? 'Cliente atualizado.' : 'Cliente cadastrado.');
    load();
  }

  async function excluir(c: C) {
    if (!confirm(`Excluir o cliente ${c.nome}?`)) return;

    const { error } = await db.from('clients').delete().eq('id', c.id);

    if (error) {
      return setMsg('Não foi possível excluir. O cliente pode estar vinculado a um imóvel.');
    }

    setMsg('Cliente excluído.');
    load();
  }

  const list = rows.filter(c =>
    [c.nome, c.telefone, c.email]
      .join(' ')
      .toLowerCase()
      .includes(busca.toLowerCase())
  );

  return (
    <div className="shell">
      <Nav />

      <main className="content">
        <header>
          <div>
            <span className="eyebrow">GESTÃO NT ALPHA</span>
            <h1>Clientes</h1>
            <p className="page-intro">
              Cadastro e relacionamento com clientes e proprietários.
            </p>
          </div>
          <button onClick={novo}>+ Novo cliente</button>
        </header>

        {viewClient && (
          <section className="panel">
            <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div>
                <span className="eyebrow">CADASTRO DO CLIENTE</span>
                <h2 style={{marginBottom:4}}>{viewClient.nome}</h2>
                <p className="page-intro" style={{margin:0}}>Visualização somente leitura.</p>
              </div>
              <div className="actions">
                <button type="button" onClick={()=>editar(viewClient)}>Editar cadastro</button>
                <button type="button" className="secondary-button" onClick={()=>setViewClient(null)}>Fechar</button>
              </div>
            </div>

            <div className="grid" style={{marginTop:22}}>
              <div><small>Telefone / WhatsApp</small><br/><strong>{viewClient.telefone || '—'}</strong></div>
              <div><small>E-mail</small><br/><strong>{viewClient.email || '—'}</strong></div>
              <div><small>CPF</small><br/><strong>{viewClient.cpf || '—'}</strong></div>
              <div><small>Novidades</small><br/><strong>{viewClient.aceita_novidades ? 'Autorizado' : 'Não autorizado'}</strong></div>
            </div>

            {viewClient.observacoes && (
              <div style={{marginTop:18}}>
                <small>Observações</small>
                <p>{viewClient.observacoes}</p>
              </div>
            )}

            <section style={{marginTop:28,paddingTop:24,borderTop:'1px solid #e5d8bd'}}>
              <span className="eyebrow">CARTEIRA DO CLIENTE</span>
              <h2 style={{marginBottom:4}}>Imóveis vinculados</h2>
              <p className="page-intro" style={{marginTop:0}}>Imóveis em que este cliente é o proprietário atual.</p>

              {loadingImoveis ? (
                <div className="empty"><strong>Carregando imóveis...</strong></div>
              ) : erroImoveis ? (
                <div className="status">{erroImoveis}</div>
              ) : imoveis.length === 0 ? (
                <div className="empty"><strong>Nenhum imóvel vinculado atualmente.</strong></div>
              ) : (
                <div className="data-list">
                  {imoveis.map(imovel=>(
                    <article className="data-card crud-card" key={imovel.id}>
                      <div>
                        <strong>{imovel.codigo} — {imovel.titulo}</strong>
                        <span>{[imovel.tipo,imovel.bairro,imovel.cidade].filter(Boolean).join(' · ') || 'Localização não informada'}</span>
                      </div>
                      <div><small>Valor</small><b>{dinheiro(imovel.valor)}</b></div>
                      <div><small>Status</small><b>{imovel.status || '—'}</b></div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}

        {open && (
          <section className="panel form quick-form">
            <h2>{editId ? 'Editar cliente' : 'Cadastro avulso'}</h2>

            <form onSubmit={salvar}>
              <div className="grid">
                <label>
                  Nome *
                  <input
                    required
                    value={f.nome}
                    onChange={e => setF({ ...f, nome: e.target.value })}
                  />
                </label>

                <label>
                  Telefone / WhatsApp *
                  <input
                    required
                    value={f.telefone}
                    onChange={e => setF({ ...f, telefone: e.target.value })}
                  />
                </label>

                <label>
                  E-mail
                  <input
                    type="email"
                    value={f.email}
                    onChange={e => setF({ ...f, email: e.target.value })}
                  />
                </label>

                <label>
                  CPF
                  <input
                    value={f.cpf}
                    onChange={e => setF({ ...f, cpf: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Observações
                <textarea
                  rows={3}
                  value={f.observacoes}
                  onChange={e => setF({ ...f, observacoes: e.target.value })}
                />
              </label>

              <div className="consent-box">
                <label>
                  <input
                    type="checkbox"
                    checked={f.aceita_novidades}
                    onChange={e =>
                      setF({ ...f, aceita_novidades: e.target.checked })
                    }
                  />
                  {' '}Cliente autorizou receber novidades da NT ALPHA.
                </label>
              </div>

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

            {editId && (
              <section
                style={{
                  marginTop: 28,
                  paddingTop: 24,
                  borderTop: '1px solid #e5d8bd',
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <span className="eyebrow">CARTEIRA DO CLIENTE</span>
                  <h2 style={{ marginBottom: 4 }}>Imóveis vinculados</h2>
                  <p className="page-intro" style={{ margin: 0 }}>
                    Imóveis em que este cliente é o proprietário atual.
                  </p>
                </div>

                {loadingImoveis ? (
                  <div className="empty">
                    <strong>Carregando imóveis...</strong>
                  </div>
                ) : erroImoveis ? (
                  <div className="status">{erroImoveis}</div>
                ) : imoveis.length === 0 ? (
                  <div className="empty">
                    <strong>Nenhum imóvel vinculado atualmente.</strong>
                  </div>
                ) : (
                  <div className="data-list">
                    {imoveis.map(imovel => (
                      <article className="data-card crud-card" key={imovel.id}>
                        <div>
                          <strong>
                            {imovel.codigo} — {imovel.titulo}
                          </strong>
                          <span>
                            {[imovel.tipo, imovel.bairro, imovel.cidade]
                              .filter(Boolean)
                              .join(' · ') || 'Localização não informada'}
                          </span>
                        </div>

                        <div>
                          <small>Valor</small>
                          <b>{dinheiro(imovel.valor)}</b>
                        </div>

                        <div>
                          <small>Status</small>
                          <b>{imovel.status || '—'}</b>
                        </div>

                        <div className="row-actions">
                          <a
                            className="secondary-button"
                            href={`/imoveis?editar=${encodeURIComponent(imovel.id)}`}
                          >
                            Editar imóvel
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </section>
        )}

        {msg && <div className="status">{msg}</div>}

        <section className="panel">
          <div className="toolbar">
            <input
              placeholder="Buscar por nome, telefone ou e-mail"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            <div className="result-count">{list.length} cliente(s)</div>
          </div>

          {list.length === 0 ? (
            <div className="empty">
              <strong>Nenhum cliente encontrado.</strong>
            </div>
          ) : (
            <div className="data-list">
              {list.map(c => (
                <article className="data-card crud-card" key={c.id}>
                  <div>
                    <strong>{c.nome}</strong>
                    <span>
                      {c.email || '—'} · {c.telefone || '—'}
                    </span>
                  </div>

                  <div>
                    <small>Novidades</small>
                    <b>{c.aceita_novidades ? 'Autorizado' : 'Não autorizado'}</b>
                  </div>

                  <div className="row-actions">
                    <button className="secondary-button" onClick={() => visualizar(c)}>Visualizar</button>
                    <button onClick={() => editar(c)}>Editar</button>
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
