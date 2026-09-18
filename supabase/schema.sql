create extension if not exists pgcrypto;
create type public.property_status as enum ('disponivel','reservado','vendido','inativo');
create table public.properties (
 id uuid primary key default gen_random_uuid(),
 codigo text unique,
 titulo text not null,
 tipo text not null,
 cidade text,
 bairro text,
 endereco text,
 valor numeric(14,2),
 dormitorios integer not null default 0,
 suites integer not null default 0,
 vagas integer not null default 0,
 area_util numeric(10,2),
 descricao text,
 caracteristicas text[] not null default '{}',
 status public.property_status not null default 'disponivel',
 destaque boolean not null default false,
 publicar_site boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.property_images (id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id) on delete cascade,path text not null,ordem integer not null default 0,created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade,nome text not null,role text not null check(role in ('ADMIN','NIVALDO','RAFAEL')),created_at timestamptz not null default now());
alter table public.properties enable row level security;alter table public.property_images enable row level security;alter table public.profiles enable row level security;
create policy "public reads published properties" on public.properties for select using (publicar_site=true and status='disponivel');
create policy "authenticated manages properties" on public.properties for all to authenticated using (true) with check (true);
create policy "authenticated manages images" on public.property_images for all to authenticated using (true) with check (true);
create policy "own profile" on public.profiles for select to authenticated using (auth.uid()=id);
