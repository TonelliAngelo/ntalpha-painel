-- NT ALPHA - endurecimento para entrada em produção
-- NÃO executar o supabase/schema.sql novamente em produção.
-- Esta migration é incremental e deve ser executada no projeto Supabase de produção.

begin;

-- PRÉ-VALIDAÇÃO: interrompe se já houver mais de uma capa para o mesmo imóvel.
do $$
begin
  if exists (
    select 1
    from public.property_images
    where tipo = 'foto' and principal = true
    group by property_id
    having count(*) > 1
  ) then
    raise exception 'Existem imóveis com mais de uma foto principal. Corrija antes da migration.';
  end if;
end $$;

-- PRÉ-VALIDAÇÃO: interrompe se já houver mais de uma publicação para o mesmo imóvel/canal.
do $$
begin
  if exists (
    select property_id, channel
    from public.property_publications
    group by property_id, channel
    having count(*) > 1
  ) then
    raise exception 'Existem publicações duplicadas por imóvel/canal. Corrija antes da migration.';
  end if;
end $$;

-- 1) Evita duas publicações do mesmo imóvel para o mesmo canal.
-- Verificação prévia: se esta instrução acusar duplicidade, pare e trate os registros antes de prosseguir.
create unique index if not exists ux_property_publications_property_channel
  on public.property_publications(property_id, channel);

-- 2) Hash SHA-256 da mídia para bloquear duplicatas exatas no mesmo imóvel.
-- Registros antigos podem permanecer com sha256 = NULL; novos uploads passam a preencher o hash.
alter table public.property_images
  add column if not exists sha256 text;

create unique index if not exists ux_property_images_property_sha256
  on public.property_images(property_id, sha256)
  where sha256 is not null;

-- 3) Garante que só exista uma capa por imóvel.
create unique index if not exists ux_property_images_one_cover
  on public.property_images(property_id)
  where tipo = 'foto' and principal = true;

commit;
