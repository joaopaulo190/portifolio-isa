# Como ligar o painel admin (uns 10 minutos)

## 1. Criar o projeto no Supabase
1. Entre em https://supabase.com e crie uma conta grátis.
2. Clique em **New project**, dê um nome (ex.: `portfolio`), crie uma senha do banco e escolha a região **South America (São Paulo)**.
3. Espere uns 2 minutos até o projeto ficar pronto.

## 2. Criar as tabelas
1. Abra o arquivo `supabase/schema.sql` e troque `SEU_EMAIL_AQUI@exemplo.com` pelo **seu e-mail**.
2. No Supabase, vá em **SQL Editor → New query**, cole o arquivo inteiro e clique em **Run**.

## 3. Criar o seu login (e bloquear outros)
1. Vá em **Authentication → Users → Add user → Create new user**.
2. Use **o mesmo e-mail** do passo 2, crie uma senha forte e marque **Auto Confirm User**.
3. Vá em **Authentication → Sign In / Providers** e **desative "Allow new users to sign up"**.
   Assim ninguém mais consegue criar conta. Mesmo que alguém crie, as regras do banco só liberam os dados para o seu e-mail.

## 4. Colocar as chaves no site
1. Vá em **Project Settings → API** (ou **Data API**).
2. Copie a **Project URL** e a chave **anon / public**.
3. Cole as duas no arquivo `config.js`.

## 5. Testar
- Abra `index.html`: a visita já é registrada.
- Abra `admin.html` e entre com seu e-mail e senha.
- Depois que você entra no painel, as visitas feitas **por esse navegador** deixam de ser contadas, para não misturar as suas com as dos visitantes.

## O que o painel mostra
- **Visão geral:** número de visitas, visitantes únicos, tempo médio no site, gráfico por dia, cidades, de onde vieram (Google, Instagram, LinkedIn…), dispositivos, navegadores, seções mais vistas e cliques.
- **Visitas:** a lista de cada acesso com data, cidade, IP, dispositivo, origem, tempo, e se a pessoa é nova ou voltou. Clicando numa visita, você vê tudo o que a pessoa fez no site.
- **Mensagens:** o que chega pelo formulário de contato, com botão para responder.
- **Projetos:** adicionar, editar, ocultar ou apagar os projetos que aparecem no site.

## Dica: saber de onde veio cada link
Quando divulgar o site, adicione `?ref=nome` no final do link. O painel mostra esse nome como origem.
- `seusite.com/?ref=instagram`
- `seusite.com/?ref=curriculo`
- `seusite.com/?ref=whatsapp`

## Importante
- O painel **não mostra o nome** de quem visitou, porque o navegador não informa isso. Ele mostra a cidade aproximada (pelo IP), o dispositivo e o que a pessoa fez. Quem enviou mensagem aparece com nome e e-mail.
- Pela LGPD, IP é um dado pessoal. Por isso coloquei um aviso no rodapé do site, e você pode apagar visitas pelo painel quando quiser.
