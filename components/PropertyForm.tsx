'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type PhotoItem = {
  id: string;
  file: File;
  preview: string;
};

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
    valor: '',
    area_util: '',
    dormitorios: '0',
    suites: '0',
    vagas: '0',
    status: 'disponivel',
    descricao: '',
    destaque: false,
    publicar_site: false,
  });

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

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
          valor: f.valor ? Number(f.valor) : null,
          area_util: f.area_util ? Number(f.area_util) : null,
          dormitorios: Number(f.dormitorios) || 0,
          suites: Number(f.suites) || 0,
          vagas: Number(f.vagas) || 0,
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
      <div className="grid">
        <label>
          Título *
          <input
            required
            value={f.titulo}
            onChange={(e) => setF({ ...f, titulo: e.target.value })}
            placeholder="Ex.: Casa contemporânea em Alphaville"
          />
        </label>

        <label>
          Tipo
          <select
            value={f.tipo}
            onChange={(e) => setF({ ...f, tipo: e.target.value })}
          >
            <option>Casa</option>
            <option>Apartamento</option>
            <option>Terreno</option>
          </select>
        </label>

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
          Endereço
          <input
            value={f.endereco}
            onChange={(e) => setF({ ...f, endereco: e.target.value })}
          />
        </label>

        <label>
          Valor (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })}
          />
        </label>

        <label>
          Área útil (m²)
          <input
            type="number"
            min="0"
            step="0.01"
            value={f.area_util}
            onChange={(e) =>
              setF({ ...f, area_util: e.target.value })
            }
          />
        </label>

        <label>
          Dormitórios
          <input
            type="number"
            min="0"
            value={f.dormitorios}
            onChange={(e) =>
              setF({ ...f, dormitorios: e.target.value })
            }
          />
        </label>

        <label>
          Suítes
          <input
            type="number"
            min="0"
            value={f.suites}
            onChange={(e) => setF({ ...f, suites: e.target.value })}
          />
        </label>

        <label>
          Vagas
          <input
            type="number"
            min="0"
            value={f.vagas}
            onChange={(e) => setF({ ...f, vagas: e.target.value })}
          />
        </label>

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

      <label>
        Descrição
        <textarea
          rows={6}
          value={f.descricao}
          onChange={(e) => setF({ ...f, descricao: e.target.value })}
        />
      </label>

      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={f.destaque}
            onChange={(e) =>
              setF({ ...f, destaque: e.target.checked })
            }
          />
          {' '}Destaque
        </label>

        <label>
          <input
            type="checkbox"
            checked={f.publicar_site}
            onChange={(e) =>
              setF({ ...f, publicar_site: e.target.checked })
            }
          />
          {' '}Publicar no site
        </label>
      </div>

      <section className="upload media-upload">
        <div className="media-title">
          <div>
            <b>Fotos do imóvel</b>
            <p>
              Até 10 fotos. JPEG, PNG ou WebP. Máximo de 5 MB
              por foto.
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
                        <span className="cover-badge">
                          CAPA
                        </span>
                      )}
                    </div>

                    <div className="property-media-info">
                      <small>Foto {index + 1}</small>
                      <span title={photo.file.name}>
                        {photo.file.name}
                      </span>
                    </div>

                    <div className="property-media-actions">
                      {!isCover && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => defineCover(photo.id)}
                          disabled={saving}
                        >
                          Definir como capa
                        </button>
                      )}

                      {isCover && (
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

      <section className="upload media-upload">
        <div className="media-title">
          <div>
            <b>Vídeo do imóvel</b>
            <p>
              Opcional. 1 vídeo por imóvel em MP4 ou WebM, até
              50 MB.
            </p>
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
            <video
              src={videoPreview}
              controls
              preload="metadata"
            />

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
