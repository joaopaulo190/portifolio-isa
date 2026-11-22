-- =====================================================================
--  Permissões das tabelas (rode no SQL Editor depois do schema.sql)
--  Quem pode ver/editar o quê continua sendo controlado pelas regras
--  (RLS) do schema.sql — aqui só liberamos o acesso básico às tabelas.
-- =====================================================================
grant usage on schema public to anon, authenticated;

-- Visitantes: ler projetos e registrar visitas, eventos e mensagens
grant select on public.projects to anon, authenticated;
grant insert on public.visits, public.events, public.messages to anon, authenticated;

-- Você logado: tudo (as regras RLS garantem que só o seu e-mail consegue)
grant select, insert, update, delete on public.visits, public.events, public.messages, public.projects to authenticated;

-- Necessário para os IDs automáticos
grant usage, select on all sequences in schema public to anon, authenticated;

-- Funções usadas pelo site e pelo painel
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.update_visit_duration(uuid, integer) to anon, authenticated;
