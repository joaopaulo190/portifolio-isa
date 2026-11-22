-- =====================================================================
--  Seus projetos reais (rode uma vez no SQL Editor)
--  1) adiciona os campos novos  2) apaga os projetos de exemplo
--  3) cadastra os seus 6 projetos (com galerias e histórias)
-- =====================================================================
alter table public.projects add column if not exists client    text;
alter table public.projects add column if not exists features  text[] default '{}';
alter table public.projects add column if not exists impact    text;
alter table public.projects add column if not exists image_url text;
alter table public.projects add column if not exists gallery   text[] default '{}';
alter table public.projects add column if not exists steps     text[] default '{}';

-- remove os exemplos e versões antigas destes projetos (pode rodar quantas vezes quiser)
delete from public.projects where title in ('ShopFlow', 'Controle de Estoque', 'Agenda Online', 'Painel de Preços para TV', 'Terminal de Consulta de Preço', 'Gerador de Etiquetas de Gôndola', 'Sistema Financeiro Empresarial', 'Diário de Treino + Anamnese', 'Controle Financeiro Familiar');

insert into public.projects (title, client, description, features, impact, tags, category, image_url, emoji, color1, color2, gallery, steps, sort_order)
select * from (values
  ('Painel de Preços para TV',
   'Comercial União Sá · Açougue',
   'Painel para a televisão do açougue com os preços das carnes, as ofertas destacadas na própria lista e o mascote do mercado.',
   array['Roda offline no computador ligado à TV', 'Ofertas destacadas sem trocar de tela', 'Identidade visual do mercado'],
   'Os clientes veem os preços de longe, e as ofertas chamam mais atenção.',
   array['HTML/CSS/JS', 'Sinalização digital', 'Offline'],
   'varejo',
   'img/acougue-sistema.jpg',
   '🧩',
   '#7c3aed',
   '#06b6d4',
   array['img/acougue-sistema.jpg | Tela do painel: preços das carnes com a oferta em destaque', 'img/acougue-tv.jpg | Foto real: TV do açougue com a tela de expediente encerrado', 'img/acougue-ambiente.jpg | Foto real: TV instalada na parede do açougue'],
   array['O problema: Quando entrei, o açougue não tinha televisão nem cartaz de preços. O açougueiro precisava falar o preço de cada carne para cada cliente.', 'A ideia: Levei ao meu patrão a proposta de colocar uma TV no açougue mostrando os preços. Ele aprovou.', 'A solução: Criei o sistema do zero, com a logo, as cores e o mascote do mercado. As ofertas aparecem em destaque na lista, e depois do horário a tela muda sozinha para "Expediente encerrado".', 'O resultado: O cliente vê os preços de longe, sem precisar perguntar, e o açougueiro fica livre para atender.'],
   1),

  ('Terminal de Consulta de Preço',
   'Comercial União Sá · Supermercado',
   'O cliente passa o produto no leitor de código de barras e vê na hora o nome e o preço. Quando ninguém está usando, a tela mostra propagandas do mercado.',
   array['Funciona com o leitor Elgin Flash II', 'Visual com a marca e as cores do mercado', 'Propagandas automáticas na tela ociosa'],
   'Menos clientes perguntando preço no caixa e mais vendas com as propagandas.',
   array['HTML/CSS/JS', 'Leitor de código de barras', 'Varejo'],
   'varejo',
   'img/consulta-tela-produto.jpg',
   '🧩',
   '#7c3aed',
   '#06b6d4',
   array['img/consulta-tela-inicial.jpg | Tela inicial: “Consulte o preço aqui”', 'img/consulta-tela-produto.jpg | Produto consultado: nome e preço na hora, com o mascote', 'img/consulta-tela-produto2.jpg | Outro produto consultado', 'img/consulta-tela-nao-encontrado.jpg | Produto não encontrado: orienta o cliente a procurar um atendente', 'img/consulta-tela-manutencao.jpg | Tela de manutenção: “Voltamos já”', 'img/consulta-tela-produtos.jpg | Área de produtos: atualização de preços pelo PDF do inventário, cadastro e edição', 'img/consulta-produto.jpg | Foto real: terminal em uso no mercado', 'img/consulta-inicio.jpg | Foto real: tela inicial no monitor do mercado'],
   array['O problema: Também não existia leitor de preço. O cliente não tinha como conferir o preço de um produto sozinho e precisava perguntar a um funcionário ou ir até o caixa.', 'A ideia: Propus ao meu patrão um terminal de consulta usando um computador e um leitor de código de barras. Ele aprovou.', 'A solução: Desenvolvi o sistema: o cliente passa o produto no leitor e vê na hora o nome e o preço, com o mascote do mercado. A tela mostra a data da última atualização dos preços.', 'O resultado: O cliente tem autonomia para conferir os preços, e a equipe recebe menos perguntas.'],
   2),

  ('Gerador de Etiquetas de Gôndola',
   'Comercial União Sá · Supermercado',
   'Antes as etiquetas de preço eram feitas uma a uma no Canva. Criei uma ferramenta que gera as etiquetas com código de barras prontas para imprimir em folha A4.',
   array['3 tamanhos (pequena, grande e extra grande) escolhidos por botão', 'Código de barras gerado automaticamente', 'Mesmo layout de antes, com o logo e as cores do mercado'],
   'Agiliza a produção de cerca de 40 folhas de etiquetas por dia.',
   array['HTML/CSS/JS', 'Código de barras', 'Automação'],
   'varejo',
   'img/etiquetas-tela-pequenas.jpg',
   '🧩',
   '#7c3aed',
   '#06b6d4',
   array['img/etiquetas-tela-inicial.jpg | Tela inicial: escolha do tamanho e busca de produtos', 'img/etiquetas-tela-pequenas.jpg | Etiquetas pequenas (perfumaria): 14 por folha', 'img/etiquetas-tela-grandes.jpg | Etiquetas grandes (biscoito, milho verde…): 16 por folha', 'img/etiquetas-tela-extragrandes.jpg | Etiquetas extra grandes (flocão, papel higiênico…): 6 por folha', 'img/etiquetas-tela-cadastro.jpg | Cadastro e atualização de produtos pelo PDF do inventário', 'img/etiquetas-sistema.jpg | Prévia das etiquetas prontas para imprimir em A4'],
   array['O problema: As etiquetas de preço da gôndola eram montadas uma a uma no Canva, com o código de barras gerado à parte. Eram cerca de 40 folhas por dia.', 'A solução: Criei uma ferramenta própria: busco o produto pelo nome ou pelo código, confiro o preço e ela gera a folha A4 pronta para imprimir, com o código de barras.', 'O resultado: Três tamanhos (pequena, grande e extra grande), o mesmo layout de antes e muito menos tempo gasto todos os dias.'],
   3),

  ('Sistema Financeiro Empresarial',
   'Empresa confidencial · grupo com 3 empresas',
   'Sistema de contas a pagar para três empresas do mesmo grupo, com os valores separados por empresa e por conta bancária. Começou como planilha e virou um site com login.',
   array['Status pago, a vencer e atrasado, com dias de atraso e juros', 'Folha quinzenal, diárias e custo por colaborador', 'Recibos padronizados, histórico de alterações e exportação para Excel', 'Resumo semanal em imagem para os donos aprovarem os pagamentos'],
   'Os donos aprovam os pagamentos só olhando o resumo, sem precisar ler PDF.',
   array['Excel / Google Planilhas', 'Web app', 'Login', 'Relatórios'],
   'financeiro',
   null,
   '💼',
   '#ff7a18',
   '#ffb000',
   '{}'::text[],
   '{}'::text[],
   4),

  ('Diário de Treino + Anamnese',
   'Isabela Medeiros · Personal Trainer',
   'App para os alunos de uma personal trainer. O aluno faz check-in no dia do treino, registra séries e cargas e acompanha a evolução em gráficos. Também tem um painel de anamnese ligado ao formulário de avaliação dos alunos.',
   array['Login por e-mail e senha para cada aluno', 'Banco de dados em nuvem (Firebase)', 'Gráficos de intensidade e evolução de carga'],
   'A personal acompanha todos os alunos em um só lugar.',
   array['Firebase', 'Autenticação', 'Google Forms', 'Gráficos'],
   'saude',
   null,
   '💪',
   '#0f3d33',
   '#16a37f',
   '{}'::text[],
   '{}'::text[],
   5),

  ('Controle Financeiro Familiar',
   'Projeto pessoal',
   'Começou como uma planilha e virou um site com login para organizar as finanças da família, com cartões, parcelas, metas e dinheiro emprestado.',
   array['Cadastro de bancos e cartões, com limite', 'Compras parceladas com data de vencimento da fatura', 'Metas com quanto falta e dicas, além das contas a receber'],
   'Mostra para onde vai cada real e quanto falta para cada meta.',
   array['Web app', 'Dashboard', 'Login'],
   'financeiro',
   null,
   '🏠',
   '#2a1b6b',
   '#5b3fd6',
   '{}'::text[],
   '{}'::text[],
   6)
) as v(title, client, description, features, impact, tags, category, image_url, emoji, color1, color2, gallery, steps, sort_order);
