-- =====================================================================
--  Banco de dados do portfólio (Supabase)
--  Cole TODO este arquivo em: Supabase > SQL Editor > New query > Run
--
--  ⚠️ ANTES DE RODAR: troque  SEU_EMAIL_AQUI@exemplo.com  (aparece 1 vez,
--  logo abaixo) pelo e-mail que você vai usar para entrar no painel.
-- =====================================================================

-- Quem é o administrador (só esse e-mail lê/edita os dados)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'joaopaulofrancamedeiros@gmail.com';
$$;

-- ---------------------------------------------------------------------
-- VISITAS: cada vez que alguém abre o site
-- ---------------------------------------------------------------------
create table if not exists public.visits (
  id          uuid primary key,
  visitor_id  text not null,          -- identifica o mesmo navegador entre visitas
  page        text,
  referrer    text,
  utm_source  text,
  browser     text,
  os          text,
  device      text,
  screen      text,
  language    text,
  timezone    text,
  ip          text,
  country     text,
  region      text,
  city        text,
  duration_s  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists visits_created_at_idx on public.visits (created_at desc);

-- ---------------------------------------------------------------------
-- EVENTOS: o que a pessoa fez no site (cliques, seções vistas...)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  visit_id    uuid references public.visits(id) on delete cascade,
  type        text not null,          -- 'section' | 'click' | 'form'
  label       text,
  created_at  timestamptz not null default now()
);
create index if not exists events_visit_idx on public.events (visit_id);

-- ---------------------------------------------------------------------
-- MENSAGENS do formulário de contato
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) <= 120),
  email       text not null check (char_length(email) <= 200),
  message     text not null check (char_length(message) <= 5000),
  visit_id    uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PROJETOS exibidos no site (editáveis pelo painel)
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id           bigint generated always as identity primary key,
  title        text not null,
  description  text,
  emoji        text default '🧩',
  color1       text default '#7c3aed',
  color2       text default '#06b6d4',
  category     text default 'web',
  tags         text[] default '{}',
  demo_url     text,
  code_url     text,
  client       text,
  features     text[] default '{}',
  impact       text,
  image_url    text,
  gallery      text[] default '{}',
  steps        text[] default '{}',
  sort_order   integer not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SEGURANÇA (Row Level Security)
--   Visitantes: só podem INSERIR visitas/eventos/mensagens e LER projetos publicados.
--   Você (admin): pode ler, editar e apagar tudo.
-- ---------------------------------------------------------------------
alter table public.visits   enable row level security;
alter table public.events   enable row level security;
alter table public.messages enable row level security;
alter table public.projects enable row level security;

drop policy if exists "visitante registra visita" on public.visits;
drop policy if exists "admin gerencia visitas"    on public.visits;
create policy "visitante registra visita" on public.visits   for insert to anon, authenticated with check (true);
create policy "admin gerencia visitas"    on public.visits   for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "visitante registra evento" on public.events;
drop policy if exists "admin gerencia eventos"    on public.events;
create policy "visitante registra evento" on public.events   for insert to anon, authenticated with check (true);
create policy "admin gerencia eventos"    on public.events   for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "visitante envia mensagem" on public.messages;
drop policy if exists "admin gerencia mensagens" on public.messages;
create policy "visitante envia mensagem" on public.messages for insert to anon, authenticated with check (read = false);
create policy "admin gerencia mensagens" on public.messages for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "todos veem projetos publicados" on public.projects;
drop policy if exists "admin gerencia projetos"        on public.projects;
create policy "todos veem projetos publicados" on public.projects for select to anon, authenticated using (published or public.is_admin());
create policy "admin gerencia projetos"        on public.projects for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Atualiza o tempo de permanência sem dar permissão de UPDATE ao visitante
create or replace function public.update_visit_duration(p_visit uuid, p_seconds integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.visits
     set duration_s = least(greatest(duration_s, p_seconds), 86400)
   where id = p_visit
     and created_at > now() - interval '1 day';
$$;
grant execute on function public.update_visit_duration(uuid, integer) to anon, authenticated;

-- Permissões básicas das tabelas (as regras acima continuam valendo)
grant usage on schema public to anon, authenticated;
grant select on public.projects to anon, authenticated;
grant insert on public.visits, public.events, public.messages to anon, authenticated;
grant select, insert, update, delete on public.visits, public.events, public.messages, public.projects to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Projetos: cadastre os seus rodando supabase/projetos-reais.sql
-- ---------------------------------------------------------------------
