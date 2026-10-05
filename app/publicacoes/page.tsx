'use client';

import { useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

type Property = {
  id: string;
  codigo: string | null;
  titulo: string;
  cidade: string | null;
  bairro: string | null;
  valor: number | null;
  status: string;
  destaque: boolean;
  publicar_site: boolean;
};

type Publication = {
  id: string;
  property_id: string;
  channel: string;
  enabled: boolean;
  status: string;
  external_id: string | null;
  external_url: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

type HistoryItem = {
  id: string;
  property_id: string;
  publication_id: string | null;
  channel: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  previous_enabled: boolean | null;
  new_enabled: boolean | null;
  actor_user_id: string | null;
  actor_name: string | null;
  details: string | null;
  created_at: string;
};

const CHANNELS = [
  { key: 'site', label: 'Site NT ALPHA', icon: '🌐' },
  { key: 'olx', label: 'OLX', icon: '🟠' },
  { key: 'zap', label: 'ZAP Imóveis', icon: '🔵' },
  { key: 'vivareal', label: 'VivaReal', icon: '🟣' },
  { key: 'instagram', label: 'Instagram', icon: '📷' },
  { key: 'facebook', label: 'Facebook', icon: '🔵' },
  { key: 'google', label: 'Google', icon: '🔎' },
] as const;

function moeda(value: number | null) {
  if (value == null) return 'Consulte';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function channelLabel(channel: string) {
  return CHANNELS.find((x) => x.key === channel)?.label ?? channel;
}

function statusLabel(publication: Publication | undefined) {
  if (!publication?.enabled) return 'Não publicado';
  if (publication.status === 'publicado') return 'Publicado';
  if (publication.status === 'erro') return 'Erro';
  return 'Ativo / pendente';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function actionLabel(action: string) {
  if (action === 'ativar') return 'Ativação';
  if (action === 'desativar') return 'Desativação';
  return action;
}

export default function PublicacoesPage() {
  const db = useMemo(() => supabase(), []);

  const [properties, setProperties] = useState<Property[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function load() {
    setLoading(true);
    setMsg('');

    const [p, pp] = await Promise.all([
      db
        .from('properties')
        .select(
          'id,codigo,titulo,cidade,bairro,valor,status,destaque,publicar_site'
        )
        .order('created_at', { ascending: false }),
      db
        .from('property_publications')
        .select(
          'id,property_id,channel,enabled,status,external_id,external_url,last_sync_at,last_error'
        )
        .order('created_at', { ascending: true }),
    ]);

    if (p.error) setMsg('Erro ao carregar imóveis: ' + p.error.message);
    else setProperties((p.data ?? []) as Property[]);

    if (pp.error) setMsg('Erro ao carregar publicações: ' + pp.error.message);
    else setPublications((pp.data ?? []) as Publication[]);

    setLoading(false);
  }

  async function loadHistory() {
    setLoadingHistory(true);

    const { data, error } = await db
      .from('publication_history')
      .select(
        'id,property_id,publication_id,channel,action,previous_status,new_status,previous_enabled,new_enabled,actor_user_id,actor_name,details,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setMsg((current) =>
        current ? current : 'Histórico indisponível: ' + error.message
      );
      setHistory([]);
    } else {
      setHistory((data ?? []) as HistoryItem[]);
    }

    setLoadingHistory(false);
  }

  useEffect(() => {
    void load();
    void loadHistory();
  }, []);

  function pubFor(propertyId: string, channel: string) {
    return publications.find(
      (x) => x.property_id === propertyId && x.channel === channel
    );
  }

  async function registerHistory(
    property: Property,
    publication: Publication,
    channel: string,
    enabled: boolean
  ) {
    const { data: authData, error: authError } = await db.auth.getUser();

    if (authError) {
      console.error('Erro ao identificar usuário autenticado:', authError);
      return (
        'Histórico não registrado: erro ao identificar usuário: ' +
        authError.message
      );
    }

    const user = authData.user;

    if (!user) {
      console.error('Nenhum usuário autenticado foi identificado.');
      return 'Histórico não registrado: nenhum usuário autenticado foi identificado.';
    }

    const actorName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      'Usuário autenticado';

    const newStatus = enabled
      ? channel === 'site'
        ? 'publicado'
        : 'pendente'
      : 'nao_publicado';

    const action = enabled ? 'ativar' : 'desativar';

    const details = JSON.stringify({
      property_codigo: property.codigo,
      property_titulo: property.titulo,
      channel_label: channelLabel(channel),
    });

    const historyRecord = {
      property_id: property.id,
      publication_id: publication.id,
      channel,
      action,
      previous_status: publication.status,
      new_status: newStatus,
      previous_enabled: publication.enabled,
      new_enabled: enabled,
      actor_user_id: user.id,
      actor_name: actorName,
      details,
    };

    console.log('Registrando histórico de publicação:', historyRecord);

    const { error } = await db
      .from('publication_history')
      .insert(historyRecord);

    if (error) {
      console.error('Erro ao registrar histórico:', error);
      console.error('Registro enviado:', historyRecord);

      return (
        'Histórico não registrado: ' +
        error.message
      );
    }

    console.log('Histórico registrado com sucesso.');

    return null;
  }

  async function toggle(property: Property, channel: string) {
    const publication = pubFor(property.id, channel);

    if (!publication) {
      setMsg(
        `O canal ${channelLabel(channel)} não está cadastrado para ${
          property.codigo ?? property.titulo
        }.`
      );
      return;
    }

    if (busyId) return;

    setBusyId(publication.id);
    setMsg('');

    const enabled = !publication.enabled;

    if (channel === 'site') {
      const propertyUpdate = await db
        .from('properties')
        .update({ publicar_site: enabled })
        .eq('id', property.id);

      if (propertyUpdate.error) {
        setBusyId(null);
        setMsg(
          'Não foi possível alterar a publicação no site: ' +
            propertyUpdate.error.message
        );
        return;
      }

      const publicationUpdate = await db
        .from('property_publications')
        .update({
          enabled,
          status: enabled ? 'publicado' : 'nao_publicado',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', publication.id);

      if (publicationUpdate.error) {
        setBusyId(null);
        setMsg(
          'O imóvel foi atualizado, mas o status do canal falhou: ' +
            publicationUpdate.error.message
        );
        return;
      }
    } else {
      const publicationUpdate = await db
        .from('property_publications')
        .update({
          enabled,
          status: enabled ? 'pendente' : 'nao_publicado',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', publication.id);

      if (publicationUpdate.error) {
        setBusyId(null);
        setMsg(
          'Não foi possível alterar o canal: ' +
            publicationUpdate.error.message
        );
        return;
      }
    }

    const historyError = await registerHistory(
      property,
      publication,
      channel,
      enabled
    );

    setProperties((current) =>
      current.map((item) =>
        item.id === property.id
          ? {
              ...item,
              publicar_site:
                channel === 'site' ? enabled : item.publicar_site,
            }
          : item
      )
    );

    const nextStatus =
      channel === 'site'
        ? enabled
          ? 'publicado'
          : 'nao_publicado'
        : enabled
          ? 'pendente'
          : 'nao_publicado';

    setPublications((current) =>
      current.map((item) =>
        item.id === publication.id
          ? {
              ...item,
              enabled,
              status: nextStatus,
              last_error: null,
            }
          : item
      )
    );

    const baseMessage = `${channelLabel(channel)}: ${
      enabled
        ? channel === 'site'
          ? 'publicado'
          : 'ativado / pendente'
        : 'não publicado'
    }.`;

    setMsg(historyError ? `${baseMessage} ${historyError}` : baseMessage);

    setBusyId(null);

    // Aguarda a consulta terminar para que o histórico recém-gravado
    // apareça imediatamente na tela.
    await loadHistory();
  }

  const filtered = properties.filter((property) => {
    const text = [
      property.codigo,
      property.titulo,
      property.bairro,
      property.cidade,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (busca && !text.includes(busca.toLowerCase())) return false;

    if (
      filtroStatus &&
      filtroStatus !== 'todos' &&
      property.status !== filtroStatus
    ) {
      return false;
    }

    if (filtroCanal) {
      const publication = pubFor(property.id, filtroCanal);
      if (!publication?.enabled) return false;
    }

    return true;
  });

  const totalImoveis = properties.length;
  const publicadosSite = properties.filter((p) => p.publicar_site).length;
  const ativos = publications.filter((p) => p.enabled).length;
  const pendentes = publications.filter(
    (p) => p.enabled && p.status !== 'publicado'
  ).length;

  return (
    <div className="shell">
      <Nav />

      <main className="content">
        <header>
          <div>
            <span className="eyebrow">GESTÃO NT ALPHA</span>
            <h1>Central de Publicação</h1>
            <p className="page-intro">
              Visão central dos canais de publicação dos imóveis.
            </p>
          </div>

          <a className="button" href="/imoveis">
            Gerenciar imóveis
          </a>
        </header>

        {msg && <div className="status">{msg}</div>}

        <section className="cards">
          <article className="stat">
            <span>Imóveis cadastrados</span>
            <strong>{totalImoveis}</strong>
          </article>
          <article className="stat">
            <span>Publicados no site</span>
            <strong>{publicadosSite}</strong>
          </article>
          <article className="stat">
            <span>Canais ativos</span>
            <strong>{ativos}</strong>
          </article>
          <article className="stat">
            <span>Ativos / pendentes</span>
            <strong>{pendentes}</strong>
          </article>
        </section>

        <section className="panel">
          <div className="toolbar">
            <input
              placeholder="Buscar por código, título ou bairro"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value)}
            >
              <option value="">Todos os canais</option>
              {CHANNELS.map((channel) => (
                <option key={channel.key} value={channel.key}>
                  {channel.label}
                </option>
              ))}
            </select>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="disponivel">Disponível</option>
              <option value="reservado">Reservado</option>
              <option value="vendido">Vendido</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </section>

        <section className="panel">
          <div
            style={{
              overflowX: 'auto',
              width: '100%',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {loading ? (
              <div className="empty">
                <strong>Carregando publicações...</strong>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <strong>Nenhum imóvel encontrado.</strong>
              </div>
            ) : (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 1540,
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        width: 280,
                        minWidth: 280,
                        textAlign: 'left',
                        padding: '14px 10px',
                        verticalAlign: 'middle',
                      }}
                    >
                      Imóvel
                    </th>

                    {CHANNELS.map((channel) => (
                      <th
                        key={channel.key}
                        style={{
                          width: 155,
                          minWidth: 155,
                          maxWidth: 155,
                          textAlign: 'left',
                          padding: '14px 10px',
                          verticalAlign: 'middle',
                          whiteSpace: 'normal',
                          height: 58,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            minHeight: 28,
                            lineHeight: 1.2,
                          }}
                        >
                          <span>{channel.icon}</span>
                          <strong>{channel.label}</strong>
                        </div>
                      </th>
                    ))}

                    <th
                      style={{
                        width: 140,
                        minWidth: 140,
                        textAlign: 'left',
                        padding: '14px 10px',
                        verticalAlign: 'middle',
                      }}
                    >
                      Ação
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((property) => (
                    <tr key={property.id}>
                      <td
                        style={{
                          width: 280,
                          minWidth: 280,
                          padding: '16px 10px',
                          borderTop: '1px solid rgba(0,0,0,.08)',
                          verticalAlign: 'top',
                        }}
                      >
                        <strong>
                          {property.codigo ?? 'Sem código'} · {property.titulo}
                        </strong>
                        <div className="page-intro">
                          {[property.bairro, property.cidade]
                            .filter(Boolean)
                            .join(' · ') || 'Localização não informada'}
                        </div>
                        <small>{moeda(property.valor)}</small>
                      </td>

                      {CHANNELS.map((channel) => {
                        const publication = pubFor(property.id, channel.key);
                        const label = statusLabel(publication);
                        const isBusy = busyId === publication?.id;
                        const enabled =
                          channel.key === 'site'
                            ? property.publicar_site
                            : Boolean(publication?.enabled);

                        return (
                          <td
                            key={channel.key}
                            style={{
                              width: 155,
                              minWidth: 155,
                              maxWidth: 155,
                              padding: '16px 10px',
                              borderTop: '1px solid rgba(0,0,0,.08)',
                              verticalAlign: 'top',
                            }}
                          >
                            <div
                              style={{
                                minHeight: 44,
                                display: 'flex',
                                alignItems: 'flex-start',
                                lineHeight: 1.25,
                                marginBottom: 8,
                                overflowWrap: 'break-word',
                              }}
                            >
                              <strong>{label}</strong>
                            </div>

                            <button
                              type="button"
                              className={
                                enabled ? 'secondary-button' : 'button'
                              }
                              style={{
                                minWidth: 96,
                                minHeight: 38,
                                whiteSpace: 'nowrap',
                              }}
                              disabled={!publication || Boolean(busyId)}
                              onClick={() =>
                                void toggle(property, channel.key)
                              }
                            >
                              {isBusy
                                ? 'Processando...'
                                : enabled
                                  ? 'Desativar'
                                  : 'Ativar'}
                            </button>

                            {publication?.last_error && (
                              <div
                                style={{
                                  marginTop: 8,
                                  maxWidth: 135,
                                  fontSize: 12,
                                  lineHeight: 1.3,
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {publication.last_error}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td
                        style={{
                          width: 140,
                          minWidth: 140,
                          padding: '16px 10px',
                          borderTop: '1px solid rgba(0,0,0,.08)',
                          verticalAlign: 'top',
                        }}
                      >
                        <a className="secondary-button" href="/imoveis">
                          Abrir imóveis
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Histórico de publicação</h2>
          <p className="page-intro">
            Últimas 30 alterações realizadas nos canais de publicação.
          </p>

          {loadingHistory ? (
            <div className="empty">
              <strong>Carregando histórico...</strong>
            </div>
          ) : history.length === 0 ? (
            <div className="empty">
              <strong>Nenhuma alteração registrada ainda.</strong>
            </div>
          ) : (
            <div
              style={{
                overflowX: 'auto',
                width: '100%',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <table
                style={{
                  width: '100%',
                  minWidth: 900,
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>
                      Data
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>
                      Usuário
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>
                      Imóvel
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>
                      Canal
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>
                      Ação
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 10px' }}>
                      Alteração
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => {
                    const property = properties.find(
                      (p) => p.id === item.property_id
                    );

                    return (
                      <tr key={item.id}>
                        <td
                          style={{
                            padding: '12px 10px',
                            borderTop: '1px solid rgba(0,0,0,.08)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatDate(item.created_at)}
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            borderTop: '1px solid rgba(0,0,0,.08)',
                          }}
                        >
                          <strong>
                            {item.actor_name || 'Usuário autenticado'}
                          </strong>
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            borderTop: '1px solid rgba(0,0,0,.08)',
                          }}
                        >
                          {property
                            ? `${property.codigo ?? 'Sem código'} · ${property.titulo}`
                            : item.property_id}
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            borderTop: '1px solid rgba(0,0,0,.08)',
                          }}
                        >
                          {channelLabel(item.channel)}
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            borderTop: '1px solid rgba(0,0,0,.08)',
                          }}
                        >
                          {actionLabel(item.action)}
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            borderTop: '1px solid rgba(0,0,0,.08)',
                          }}
                        >
                          {item.previous_status || '—'} → {item.new_status || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Legenda da V2</h2>
          <div className="grid">
            <div>
              <strong>Publicado</strong>
              <p className="page-intro">
                O painel considera o canal efetivamente publicado.
              </p>
            </div>
            <div>
              <strong>Ativo / pendente</strong>
              <p className="page-intro">
                O canal foi preparado no painel, mas a integração externa
                ainda não foi executada.
              </p>
            </div>
            <div>
              <strong>Não publicado</strong>
              <p className="page-intro">
                O canal está desativado para o imóvel.
              </p>
            </div>
            <div>
              <strong>Erro</strong>
              <p className="page-intro">
                Reservado para futuras falhas de sincronização.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
