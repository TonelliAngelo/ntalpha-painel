'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type PhotoItem = {
  id: string;
  file: File;
  preview: string;
};

type ClientItem = {
  id: string;
  nome: string;
  telefone: string | null;
};

type CondominiumItem = {
  id: string;
  nome: string;
};

const PROPERTY_TYPES = [
  'Casa',
  'Casa em Condomínio',
  'Apartamento',
  'Cobertura',
  'Duplex',
  'Triplex',
  'Sobrado',
  'Terreno',
  'Prédio',
  'Galpão',
  'Comercial / Sala',
  'Outro',
];

const PROPERTY_FEATURES = [
  'Cozinha',
  'Copa',
  'Lavabo',
  'Sala de estar',
  'Sala de jantar',
  'Sala de TV',
  'Varanda',
  'Varanda gourmet',
  'Área gourmet',
  'Churrasqueira',
  'Edícula',
  'Escritório / Home Office',
  'Closet',
  'Despensa',
  'Área de serviço / Lavanderia',
  'Piscina privativa',
  'Sauna',
  'Jardim',
  'Quintal',
  'Lareira',
  'Ar-condicionado',
  'Armários planejados',
];

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

function safeFileName(name: string) {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${base || 'arquivo'}${ext}`;
}

export default function PropertyForm() {
  const db = useMemo(() => supabase(), []);
  const router = useRouter();

  const [f, setF] = useState({
    titulo: '',
    tipo: 'Casa',
    cidade: 'Barueri',
    bairro: 'Alphaville',
    endereco: '',
    bloco_torre: '',
    unidade: '',
    complemento: '',
    andar: '',
    valor: '',
    valor_condominio: '',
    valor_iptu: '',
    area_util: '',
    area_total: '',
    dormitorios: '0',
    suites: '0',
    banheiros: '0',
    vagas: '0',
    ano_construcao: '',
    mobiliado: '',
    status: 'disponivel',
    descricao: '',
    outras_caracteristicas: '',
    destaque: false,
    publicar_site: false,
  });

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [condominiums, setCondominiums] = useState<CondominiumItem[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [condominiumId, setCondominiumId] = useState('');
  const [features, setFeatures] = useState<string[]>([]);

  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    cpf: '',
    observacoes: '',
    aceita_novidades: false,
  });

  const [condominiumOpen, setCondominiumOpen] = useState(false);
  const [condominiumForm, setCondominiumForm] = useState({
    nome: '',
    cidade: 'Barueri',
    bairro: '',
    endereco: '',
    observacoes: '',
  });

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadReferences() {
    const [clientsResult, condominiumsResult] = await Promise.all([
      db
        .from('clients')
        .select('id,nome,telefone')
        .eq('ativo', true)
        .order('nome'),
      db
        .from('condominiums')
        .select('id,nome')
        .eq('ativo', true)
        .order('nome'),
    ]);

    if (!clientsResult.error) {
      setClients((clientsResult.data ?? []) as ClientItem[]);
    }

    if (!condominiumsResult.error) {
      setCondominiums(
        (condominiumsResult.data ?? []) as CondominiumItem[]
      );
    }
  }

  useEffect(() => {
    void loadReferences();
  }, []);

  async function createOwner() {
    const nome = ownerForm.nome.trim();

    if (!nome) {
      setMsg('Informe o nome do proprietário.');
      return;
    }

    const cpf = ownerForm.cpf.replace(/\D/g, '');

    if (cpf) {
      const { data: existing, error: findError } = await db
        .from('clients')
        .select('id,nome')
        .eq('cpf', cpf)
        .maybeSingle();

      if (findError) {
        setMsg(`Não foi possível validar o CPF: ${findError.message}`);
        return;
      }

      if (existing) {
        setMsg(
          `CPF já cadastrado para ${existing.nome}. Selecione o cliente existente.`
        );
        return;
      }
    }

    const { data, error } = await db
      .from('clients')
      .insert({
        nome,
        telefone: ownerForm.telefone.trim() || null,
        email: ownerForm.email.trim() || null,
        cpf: cpf || null,
        observacoes: ownerForm.observacoes.trim() || null,
        origem: 'PAINEL',
        ativo: true,
        aceita_novidades: ownerForm.aceita_novidades,
      })
      .select('id,nome,telefone')
      .single();

    if (error || !data) {
      setMsg(
        `Não foi possível cadastrar o proprietário: ${
          error?.message ?? 'erro desconhecido'
        }`
      );
      return;
    }

    await loadReferences();
    setOwnerId(data.id);
    setOwnerOpen(false);
    setOwnerForm({
      nome: '',
      telefone: '',
      email: '',
      cpf: '',
      observacoes: '',
      aceita_novidades: false,
    });
    setMsg('Proprietário cadastrado e selecionado.');
  }

  async function createCondominium() {
    const nome = condominiumForm.nome.trim();

    if (!nome) {
      setMsg('Informe o nome do condomínio.');
      return;
    }

    const { data: existing, error: findError } = await db
      .from('condominiums')
      .select('id,nome')
      .ilike('nome', nome)
      .limit(1);

    if (findError) {
      setMsg(
        `Não foi possível validar o condomínio: ${findError.message}`
      );
      return;
    }

    if (existing && existing.length > 0) {
      setMsg(
        `Já existe o condomínio "${existing[0].nome}". Selecione-o na lista.`
      );
      return;
    }

    const { data, error } = await db
      .from('condominiums')
      .insert({
        nome,
        cidade: condominiumForm.cidade.trim() || null,
        bairro: condominiumForm.bairro.trim() || null,
        endereco: condominiumForm.endereco.trim() || null,
        observacoes: condominiumForm.observacoes.trim() || null,
        ativo: true,
      })
      .select('id,nome')
      .single();

    if (error || !data) {
      setMsg(
        `Não foi possível cadastrar o condomínio: ${
          error?.message ?? 'erro desconhecido'
        }`
      );
      return;
    }

    await loadReferences();
    setCondominiumId(data.id);
    setCondominiumOpen(false);
    setCondominiumForm({
      nome: '',
      cidade: 'Barueri',
      bairro: '',
      endereco: '',
      observacoes: '',
    });
    setMsg('Condomínio cadastrado e selecionado.');
  }

  function toggleFeature(feature: string) {
    setFeatures((current) =>
      current.includes(feature)
        ? current.filter((item) => item !== feature)
        : [...current, feature]
    );
  }

  function selectPhotos(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';

    if (!selected.length) return;

    const remaining = MAX_PHOTOS - photos.length;

    if (remaining <= 0) {
      setMsg('O limite de 10 fotos já foi atingido.');
      return;
    }

    if (selected.length > remaining) {
      setMsg(
        `Você pode adicionar somente mais ${remaining} foto${
          remaining === 1 ? '' : 's'
        }.`
      );
      return;
    }

    const invalidType = selected.find(
      (file) => !PHOTO_TYPES.includes(file.type)
    );

    if (invalidType) {
      setMsg(
        `O arquivo "${invalidType.name}" não é uma foto válida. Use JPEG, PNG ou WebP.`
      );
      return;
    }

    const tooLarge = selected.find((file) => file.size > MAX_PHOTO_SIZE);

    if (tooLarge) {
      setMsg(
        `A foto "${tooLarge.name}" ultrapassa o limite de 5 MB.`
      );
      return;
    }

    const items = selected.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((current) => [...current, ...items]);
    setMsg('');
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const found = current.find((photo) => photo.id === id);

      if (found) {
        URL.revokeObjectURL(found.preview);
      }

      return current.filter((photo) => photo.id !== id);
    });

    if (coverId === id) {
      setCoverId(null);
    }

    setMsg('');
  }

  function defineCover(id: string) {
    setCoverId(id);
    setMsg('');
  }

  function selectVideo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';

    if (!file) return;

    if (!VIDEO_TYPES.includes(file.type)) {
      setMsg('O vídeo deve estar no formato MP4 ou WebM.');
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      setMsg('O vídeo ultrapassa o limite de 50 MB.');
      return;
    }

    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
    setMsg('');
  }

  function removeVideo() {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideo(null);
    setVideoPreview('');
    setMsg('');
  }

  async function cleanupStorage(paths: string[]) {
    if (!paths.length) return;

    await db.storage.from('property-images').remove(paths);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();

    if (saving) return;

    if (!ownerId) {
      setMsg('Selecione ou cadastre o proprietário do imóvel.');
      return;
    }

    if (f.publicar_site && photos.length === 0) {
      setMsg(
        'Para publicar o imóvel no site, adicione pelo menos uma foto.'
      );
      return;
    }

    if (f.publicar_site && !coverId) {
      setMsg(
        'Escolha qual foto será a capa antes de publicar o imóvel.'
      );
      return;
    }

    if (photos.length > MAX_PHOTOS) {
      setMsg('O imóvel pode possuir no máximo 10 fotos.');
      return;
    }

    setSaving(true);
    setMsg('Salvando imóvel...');

    const uploadedPaths: string[] = [];
    let propertyId: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await db.auth.getUser();

      if (userError || !user) {
        throw new Error(
          'Sua sessão expirou. Entre novamente no painel.'
        );
      }

      const { data: property, error: propertyError } = await db
        .from('properties')
        .insert({
          titulo: f.titulo.trim(),
          tipo: f.tipo,
          cidade: f.cidade.trim() || null,
          bairro: f.bairro.trim() || null,
          endereco: f.endereco.trim() || null,
          bloco_torre: f.bloco_torre.trim() || null,
          unidade: f.unidade.trim() || null,
          complemento: f.complemento.trim() || null,
          andar: f.andar ? Number(f.andar) : null,
          condominium_id: condominiumId || null,
          valor: f.valor ? Number(f.valor) : null,
          valor_condominio: f.valor_condominio
            ? Number(f.valor_condominio)
            : null,
          valor_iptu: f.valor_iptu ? Number(f.valor_iptu) : null,
          area_util: f.area_util ? Number(f.area_util) : null,
          area_total: f.area_total ? Number(f.area_total) : null,
          dormitorios: Number(f.dormitorios) || 0,
          suites: Number(f.suites) || 0,
          banheiros: Number(f.banheiros) || 0,
          vagas: Number(f.vagas) || 0,
          ano_construcao: f.ano_construcao
            ? Number(f.ano_construcao)
            : null,
          mobiliado: f.mobiliado || null,
          caracteristicas: features,
          outras_caracteristicas:
            f.outras_caracteristicas.trim() || null,
          status: f.status,
          descricao: f.descricao.trim() || null,
          destaque: f.destaque,
          publicar_site: f.publicar_site,
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id')
        .single();

      if (propertyError || !property) {
        throw new Error(
          propertyError?.message || 'Não foi possível criar o imóvel.'
        );
      }

      propertyId = property.id;

      const { error: ownerError } = await db
        .from('property_owners')
        .insert({
          property_id: property.id,
          client_id: ownerId,
          data_inicio: new Date().toISOString(),
          observacoes: null,
        });

      if (ownerError) {
        throw new Error(
          `Não foi possível vincular o proprietário: ${ownerError.message}`
        );
      }

      const mediaRows: {
        property_id: string;
        path: string;
        ordem: number;
        tipo: 'foto' | 'video';
        principal: boolean;
        nome_arquivo: string;
        mime_type: string;
        tamanho_bytes: number;
      }[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];

        setMsg(`Enviando foto ${i + 1} de ${photos.length}...`);

        const path =
          `${property.id}/fotos/` +
          `${String(i + 1).padStart(2, '0')}-` +
          `${crypto.randomUUID()}-${safeFileName(photo.file.name)}`;

        const { error: uploadError } = await db.storage
          .from('property-images')
          .upload(path, photo.file, {
            cacheControl: '3600',
            upsert: false,
            contentType: photo.file.type,
          });

        if (uploadError) {
          throw new Error(
            `Falha ao enviar "${photo.file.name}": ${uploadError.message}`
          );
        }

        uploadedPaths.push(path);

        mediaRows.push({
          property_id: property.id,
          path,
          ordem: i + 1,
          tipo: 'foto',
          principal: photo.id === coverId,
          nome_arquivo: photo.file.name,
          mime_type: photo.file.type,
          tamanho_bytes: photo.file.size,
        });
      }

      if (video) {
        setMsg('Enviando vídeo do imóvel...');

        const path =
          `${property.id}/video/` +
          `${crypto.randomUUID()}-${safeFileName(video.name)}`;

        const { error: videoError } = await db.storage
          .from('property-images')
          .upload(path, video, {
            cacheControl: '3600',
            upsert: false,
            contentType: video.type,
          });

        if (videoError) {
          throw new Error(
            `Falha ao enviar o vídeo: ${videoError.message}`
          );
        }

        uploadedPaths.push(path);

        mediaRows.push({
          property_id: property.id,
          path,
          ordem: 1,
          tipo: 'video',
          principal: false,
          nome_arquivo: video.name,
          mime_type: video.type,
          tamanho_bytes: video.size,
        });
      }

      if (mediaRows.length) {
        setMsg('Registrando fotos e vídeo...');

        const { error: mediaError } = await db
          .from('property_images')
          .insert(mediaRows);

        if (mediaError) {
          throw new Error(
            `Não foi possível registrar as mídias: ${mediaError.message}`
          );
        }
      }

      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));

      if (videoPreview) {
        URL.revokeObjectURL(videoPreview);
      }

      setMsg('Imóvel cadastrado com sucesso.');
      router.push('/imoveis');
      router.refresh();
    } catch (error) {
      await cleanupStorage(uploadedPaths);

      /*
       * Se o imóvel chegou a ser criado mas alguma mídia falhou,
       * removemos o cadastro recém-criado para não deixar um imóvel
       * incompleto ou publicado sem suas mídias.
       */
      if (propertyId) {
        await db
          .from('property_images')
          .delete()
          .eq('property_id', propertyId);

        await db
          .from('property_owners')
          .delete()
          .eq('property_id', propertyId);

        await db
          .from('properties')
          .delete()
          .eq('id', propertyId);
      }

      setMsg(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o imóvel.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={salvar}>
      <section className="form-section">
        <h2>1. Proprietário</h2>
        <div className="grid">
          <label>
            Proprietário *
            <select
              required
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nome}
                  {client.telefone ? ` · ${client.telefone}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="form-inline-action">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setOwnerOpen((current) => !current)}
            >
              + Novo proprietário
            </button>
          </div>
        </div>

        {ownerOpen && (
          <div className="quick-form nested-form">
            <h3>Cadastro rápido de proprietário</h3>
            <div className="grid">
              <label>
                Nome *
                <input
                  value={ownerForm.nome}
                  onChange={(e) =>
                    setOwnerForm({ ...ownerForm, nome: e.target.value })
                  }
                />
              </label>
              <label>
                WhatsApp / Telefone
                <input
                  value={ownerForm.telefone}
                  onChange={(e) =>
                    setOwnerForm({
                      ...ownerForm,
                      telefone: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={ownerForm.email}
                  onChange={(e) =>
                    setOwnerForm({ ...ownerForm, email: e.target.value })
                  }
                />
              </label>
              <label>
                CPF (opcional)
                <input
                  value={ownerForm.cpf}
                  onChange={(e) =>
                    setOwnerForm({ ...ownerForm, cpf: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Observações
              <textarea
                rows={2}
                value={ownerForm.observacoes}
                onChange={(e) =>
                  setOwnerForm({
                    ...ownerForm,
                    observacoes: e.target.value,
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={ownerForm.aceita_novidades}
                onChange={(e) =>
                  setOwnerForm({
                    ...ownerForm,
                    aceita_novidades: e.target.checked,
                  })
                }
              />{' '}
              Aceita receber novidades
            </label>
            <div className="actions">
              <button type="button" onClick={createOwner}>
                Cadastrar proprietário
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOwnerOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="form-section">
        <h2>2. Condomínio e localização</h2>
        <div className="grid">
          <label>
            Condomínio / Empreendimento
            <select
              value={condominiumId}
              onChange={(e) => setCondominiumId(e.target.value)}
            >
              <option value="">Sem condomínio</option>
              {condominiums.map((condominium) => (
                <option key={condominium.id} value={condominium.id}>
                  {condominium.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="form-inline-action">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setCondominiumOpen((current) => !current)
              }
            >
              + Novo condomínio
            </button>
          </div>
        </div>

        {condominiumOpen && (
          <div className="quick-form nested-form">
            <h3>Cadastro rápido de condomínio</h3>
            <div className="grid">
              <label>
                Nome *
                <input
                  value={condominiumForm.nome}
                  onChange={(e) =>
                    setCondominiumForm({
                      ...condominiumForm,
                      nome: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Cidade
                <input
                  value={condominiumForm.cidade}
                  onChange={(e) =>
                    setCondominiumForm({
                      ...condominiumForm,
                      cidade: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Bairro
                <input
                  value={condominiumForm.bairro}
                  onChange={(e) =>
                    setCondominiumForm({
                      ...condominiumForm,
                      bairro: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Endereço
                <input
                  value={condominiumForm.endereco}
                  onChange={(e) =>
                    setCondominiumForm({
                      ...condominiumForm,
                      endereco: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label>
              Observações
              <textarea
                rows={2}
                value={condominiumForm.observacoes}
                onChange={(e) =>
                  setCondominiumForm({
                    ...condominiumForm,
                    observacoes: e.target.value,
                  })
                }
              />
            </label>
            <div className="actions">
              <button type="button" onClick={createCondominium}>
                Cadastrar condomínio
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCondominiumOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="grid">
          <label>
            Cidade
            <input
              value={f.cidade}
              onChange={(e) => setF({ ...f, cidade: e.target.value })}
            />
          </label>
          <label>
            Bairro / Região
            <input
              value={f.bairro}
              onChange={(e) => setF({ ...f, bairro: e.target.value })}
            />
          </label>
          <label>
            Endereço do imóvel
            <input
              value={f.endereco}
              onChange={(e) => setF({ ...f, endereco: e.target.value })}
            />
          </label>
          <label>
            Bloco / Torre
            <input
              value={f.bloco_torre}
              onChange={(e) =>
                setF({ ...f, bloco_torre: e.target.value })
              }
            />
          </label>
          <label>
            Unidade / Apartamento
            <input
              value={f.unidade}
              onChange={(e) => setF({ ...f, unidade: e.target.value })}
            />
          </label>
          <label>
            Complemento
            <input
              value={f.complemento}
              onChange={(e) =>
                setF({ ...f, complemento: e.target.value })
              }
            />
          </label>
          <label>
            Andar
            <input
              type="number"
              min="0"
              value={f.andar}
              onChange={(e) => setF({ ...f, andar: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>3. Dados do imóvel</h2>
        <div className="grid">
          <label>
            Título *
            <input
              required
              value={f.titulo}
              onChange={(e) => setF({ ...f, titulo: e.target.value })}
              placeholder="Ex.: Apartamento de alto padrão em Alphaville"
            />
          </label>
          <label>
            Tipo
            <select
              value={f.tipo}
              onChange={(e) => setF({ ...f, tipo: e.target.value })}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {[
            ['Dormitórios', 'dormitorios'],
            ['Suítes', 'suites'],
            ['Banheiros', 'banheiros'],
            ['Vagas', 'vagas'],
            ['Área útil / construída (m²)', 'area_util'],
            ['Área total / terreno (m²)', 'area_total'],
            ['Ano de construção', 'ano_construcao'],
          ].map(([label, key]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                step={
                  key === 'area_util' || key === 'area_total'
                    ? '0.01'
                    : '1'
                }
                value={String(f[key as keyof typeof f])}
                onChange={(e) =>
                  setF({ ...f, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            Mobiliado
            <select
              value={f.mobiliado}
              onChange={(e) =>
                setF({ ...f, mobiliado: e.target.value })
              }
            >
              <option value="">Não informado</option>
              <option value="nao">Não</option>
              <option value="parcial">Parcialmente</option>
              <option value="sim">Sim</option>
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>4. Valores</h2>
        <div className="grid">
          {[
            ['Valor de venda (R$)', 'valor'],
            ['Condomínio (R$)', 'valor_condominio'],
            ['IPTU (R$)', 'valor_iptu'],
          ].map(([label, key]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                step="0.01"
                value={String(f[key as keyof typeof f])}
                onChange={(e) =>
                  setF({ ...f, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>5. Características</h2>
        <div className="feature-grid">
          {PROPERTY_FEATURES.map((feature) => (
            <label key={feature}>
              <input
                type="checkbox"
                checked={features.includes(feature)}
                onChange={() => toggleFeature(feature)}
              />{' '}
              {feature}
            </label>
          ))}
        </div>
        <label>
          Outras características
          <textarea
            rows={3}
            value={f.outras_caracteristicas}
            onChange={(e) =>
              setF({
                ...f,
                outras_caracteristicas: e.target.value,
              })
            }
            placeholder="Informe outros diferenciais do imóvel."
          />
        </label>
      </section>

      <section className="form-section">
        <h2>6. Apresentação</h2>
        <label>
          Descrição
          <textarea
            rows={6}
            value={f.descricao}
            onChange={(e) =>
              setF({ ...f, descricao: e.target.value })
            }
          />
        </label>
      </section>

      <section className="upload media-upload form-section">
        <div className="media-title">
          <div>
            <h2>7. Fotos do imóvel</h2>
            <p>
              Até 10 fotos. JPEG, PNG ou WebP. Máximo de 5 MB por
              foto.
            </p>
          </div>
          <strong>{photos.length} / 10</strong>
        </div>

        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={selectPhotos}
          disabled={saving || photos.length >= MAX_PHOTOS}
        />

        {photos.length > 0 && (
          <>
            <p className="media-help">
              Escolha manualmente qual foto será a capa do imóvel.
            </p>
            <div className="property-media-grid">
              {photos.map((photo, index) => {
                const isCover = photo.id === coverId;
                return (
                  <article
                    className={`property-media-card ${
                      isCover ? 'is-cover' : ''
                    }`}
                    key={photo.id}
                  >
                    <div className="property-media-preview">
                      <img
                        src={photo.preview}
                        alt={`Foto ${index + 1} do imóvel`}
                      />
                      {isCover && (
                        <span className="cover-badge">CAPA</span>
                      )}
                    </div>
                    <div className="property-media-info">
                      <small>Foto {index + 1}</small>
                      <span title={photo.file.name}>
                        {photo.file.name}
                      </span>
                    </div>
                    <div className="property-media-actions">
                      {!isCover ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => defineCover(photo.id)}
                          disabled={saving}
                        >
                          Definir como capa
                        </button>
                      ) : (
                        <strong className="cover-selected">
                          Foto principal
                        </strong>
                      )}
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => removePhoto(photo.id)}
                        disabled={saving}
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="upload media-upload form-section">
        <div className="media-title">
          <div>
            <h2>8. Vídeo do imóvel</h2>
            <p>Opcional. 1 vídeo por imóvel em MP4 ou WebM, até 50 MB.</p>
          </div>
          <strong>{video ? '1 / 1' : '0 / 1'}</strong>
        </div>

        {!video && (
          <input
            type="file"
            accept="video/mp4,video/webm"
            onChange={selectVideo}
            disabled={saving}
          />
        )}

        {video && (
          <div className="property-video-card">
            <video src={videoPreview} controls preload="metadata" />
            <div className="property-media-info">
              <small>Vídeo selecionado</small>
              <span>{video.name}</span>
            </div>
            <button
              type="button"
              className="danger-button"
              onClick={removeVideo}
              disabled={saving}
            >
              Remover vídeo
            </button>
          </div>
        )}
      </section>

      <section className="form-section">
        <h2>9. Gestão e publicação</h2>
        <div className="grid">
          <label>
            Status
            <select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
            >
              <option value="disponivel">Disponível</option>
              <option value="reservado">Reservado</option>
              <option value="vendido">Vendido</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={f.destaque}
              onChange={(e) =>
                setF({ ...f, destaque: e.target.checked })
              }
            />{' '}
            Destaque
          </label>
          <label>
            <input
              type="checkbox"
              checked={f.publicar_site}
              onChange={(e) =>
                setF({ ...f, publicar_site: e.target.checked })
              }
            />{' '}
            Publicar no site
          </label>
        </div>
      </section>

      {msg && <div className="status">{msg}</div>}

      <div className="actions">
        <button disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar imóvel'}
        </button>
        <a href="/imoveis">Cancelar</a>
      </div>
    </form>
  );
}
