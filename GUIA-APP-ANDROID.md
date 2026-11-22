# Guia: colocar no ar e criar o app Android

Siga na ordem. Você só faz isso **uma vez**. Depois, toda mudança no site aparece sozinha no app,
porque o app abre o seu sistema que está online.

---

## Parte 1 — Colocar o sistema no ar (GRATUITO)

O app precisa de um endereço na internet para buscar os dados dos alunos.
Vamos usar 3 serviços gratuitos: **GitHub** (guarda o código), **Turso** (guarda os dados
dos alunos) e **Render** (deixa o site no ar).

### 1. GitHub — guardar o código
1. Crie uma conta: https://github.com
2. Instale o **GitHub Desktop**: https://desktop.github.com e entre com sua conta.
3. *File → Add local repository →* escolha a pasta `  `
   (se ele pedir, clique em *create a repository* e depois *Add repository*).
4. Clique em **Publish repository** e deixe marcado **Keep this code private**.

### 2. Turso — banco de dados dos alunos
1. Crie uma conta: https://turso.tech (botão *Sign up*, entre com o GitHub). Escolha o plano **Free**.
2. Clique em **Create Database**:
   - Nome: `isabela-medeiros`
   - Região: a mais perto do Brasil que aparecer (ex.: *São Paulo* ou *US East*)
3. Abra o banco criado e copie duas informações (guarde num bloco de notas):
   - A **URL** — começa com `libsql://…`
   - O **token**: clique em *Create Token* / *Generate Token* e copie o texto longo.
   🔐 O token é como uma senha: não mande para ninguém.

### 3. Render — deixar o site no ar
1. Crie uma conta: https://render.com (entre com o GitHub).
2. Clique em **New + → Blueprint** e escolha o repositório `portifolio-isa`.
   Ele lê o arquivo `render.yaml` sozinho.
3. O Render vai pedir 3 valores. Cole:
   - `TURSO_DATABASE_URL` → a URL `libsql://…` do Turso
   - `TURSO_AUTH_TOKEN` → o token do Turso
   - `ADMIN_PASSWORD` → a senha que **você** quer usar na área da personal
4. Clique em **Apply** e espere uns minutos (a primeira vez demora).
5. Seu endereço aparece no topo, tipo `https://isabela-medeiros.onrender.com`. 🎉
6. Abra no celular e teste: crie uma conta e preencha a avaliação.
   Depois entre em `/admin` com a sua senha e veja o aluno lá. ✅

**Para atualizar o site depois:** no GitHub Desktop, *Commit* + *Push*. O Render atualiza sozinho.

> ℹ️ **Sobre o plano gratuito:** se ninguém acessar por ~15 minutos, o servidor "dorme"
> e o próximo acesso demora uns 30–50 segundos para abrir. Depois fica normal.
> Os dados **não** se perdem (ficam no Turso).
> Quando quiser que fique sempre rápido: no Render, mude o plano do serviço para **Starter**
> (~US$ 7/mês). Nada mais precisa mudar.

> 🌐 **Domínio próprio (opcional, ~R$ 40/ano):** compre `isabelamedeiros.com.br` no
> https://registro.br e adicione no Render em *Settings → Custom Domains*
> (ele mostra o que configurar). Funciona também no plano gratuito.

---

## Parte 2 — Gerar o app Android (APK)

1. Instale o **Android Studio** (gratuito): https://developer.android.com/studio
   - Abra uma vez e deixe ele terminar de baixar tudo (*Next, Next, Finish*).
2. No terminal do VS Code, rode (troque pelo seu endereço da Parte 1):
   ```
   cd mobile
   npm.cmd run configurar -- https://SEU-ENDERECO
   npm.cmd run abrir
   ```
3. O Android Studio abre o projeto. Espere a barra de baixo terminar (*Gradle sync*).
4. Menu **Build → Generate Signed App Bundle or APK… → APK → Next**.
5. Em *Key store path*, clique **Create new…**:
   - Salve como `isabela-medeiros.jks` **fora da pasta do projeto** (ex.: Documentos).
   - Crie uma senha e preencha seu nome.
   - 🔐 **Guarde esse arquivo e a senha para sempre** (Google Drive, pendrive).
     Sem eles você não consegue atualizar o app no futuro.
6. **Next → release → Create**. Quando terminar, clique em **locate**.
   O arquivo é `mobile/android/app/release/app-release.apk`.
7. Renomeie para **`isabela-medeiros.apk`** e copie para a pasta **`public/download/`**.
8. Publique (GitHub Desktop: *Commit* + *Push*).

Pronto! Agora a página **`SEU-ENDERECO/app`**, aberta num Android, mostra o botão
**“Baixar o app”**. É esse link que você manda para os alunos
(o botão *Convidar aluno no WhatsApp* da sua área já manda ele).

> Alunos com iPhone continuam instalando pelo mesmo link (*Compartilhar → Adicionar à Tela de Início*).

---

## Parte 3 — Publicar na Play Store (opcional)

1. Crie a conta de desenvolvedor: https://play.google.com/console (**US$ 25, uma vez**).
2. No Android Studio, repita a Parte 2 escolhendo **Android App Bundle** (em vez de APK),
   usando **a mesma chave** `.jks`.
3. No Play Console: *Criar app* → envie o arquivo `.aab`, ícone, prints e descrição.
4. ⚠️ Contas pessoais novas precisam fazer um **teste fechado com 12 pessoas por 14 dias**
   antes de liberar para todo mundo. Seus alunos podem ser esses testadores!

---

## Quando preciso gerar o APK de novo?

Só se mudar **nome, ícone ou endereço** do app. Mudanças no site (textos, visual, novas
funções) aparecem automaticamente no app.

Para gerar de novo: aumente a versão em `mobile/android/app/build.gradle`
(`versionCode 1` → `2`, `versionName "1.0"` → `"1.1"`) e repita a Parte 2 com a mesma chave.
