-- NT ALPHA - PRE-FLIGHT antes do deploy
-- Somente SELECTs. Não altera dados.

-- 1. Publicações duplicadas por imóvel/canal
select property_id, channel, count(*) as quantidade
from public.property_publications
group by property_id, channel
having count(*) > 1
order by property_id, channel;

-- 2. Mais de uma capa por imóvel
select property_id, count(*) as capas
from public.property_images
where tipo = 'foto' and principal = true
group by property_id
having count(*) > 1
order by property_id;

-- 3. Registros de mídia apontando para imóvel inexistente
select pi.id, pi.property_id, pi.path
from public.property_images pi
left join public.properties p on p.id = pi.property_id
where p.id is null
order by pi.created_at;

-- 4. Imóveis ativos para publicação sem foto principal
select p.id, p.codigo, p.titulo
from public.properties p
where p.status = 'disponivel'
  and not exists (
    select 1 from public.property_images pi
    where pi.property_id = p.id
      and pi.tipo = 'foto'
      and pi.principal = true
  )
order by p.codigo;

-- 5. Imóveis publicados no site sem fotos
select p.id, p.codigo, p.titulo
from public.properties p
where p.publicar_site = true
  and not exists (
    select 1 from public.property_images pi
    where pi.property_id = p.id and pi.tipo = 'foto'
  )
order by p.codigo;
