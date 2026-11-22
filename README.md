# Isabela Medeiros · Personal Trainer — Site + App

Site + aplicativo com a mesma conta e os mesmos dados:
- **Android:** app nativo (pasta `mobile/`, Capacitor) — APK enviado por link ou Play Store
- **iPhone:** app instalável pelo link `/app` (PWA)

👉 **Para colocar no ar e gerar o app Android, siga o [GUIA-APP-ANDROID.md](GUIA-APP-ANDROID.md).**

## Como rodar

Precisa do [Node.js](https://nodejs.org) 22.13 ou mais novo. Não precisa instalar nenhum pacote.

```bash
npm.cmd start
```

Abra **http://localhost:3000**.

- Área da personal: **http://localhost:3000/admin**
- A senha do admin aparece no terminal na primeira vez (fica guardada em `data/senha-admin.txt`).
  Para definir a sua, copie `.env.example` para `.env` e preencha `ADMIN_PASSWORD`.

## Fluxo do aluno

1. **Página inicial** (`/`) → "Criar minha conta"
2. **Cadastro** (`/entrar`) → nome, e-mail, WhatsApp, senha
3. **Avaliação inicial** (`/avaliacao`) → 6 etapas: Sobre você, Objetivos, Saúde, Rotina de treino, Hábitos e Revisão.
   Salva sozinha a cada resposta, então dá para parar e continuar depois de onde parou.
4. **Painel** (`/painel`) → resumo do perfil, IMC e status da avaliação

## Onde ficam os dados

Tudo fica salvo no banco SQLite `data/app.db`:

| Tabela                 | O que guarda                                         |
|------------------------|------------------------------------------------------|
| `usuarios`             | Conta do aluno (a senha fica criptografada)          |
| `avaliacoes`           | Respostas atuais da avaliação (rascunho ou enviada)  |
| `avaliacoes_historico` | Uma cópia de **cada** envio, para comparar a evolução |
| `sessoes`              | Logins ativos                                        |

> ⚠️ Faça backup da pasta `data/`: é nela que ficam todos os alunos.

## Estrutura

```
server.js            → servidor + API + banco de dados
public/
  index.html         → site (página inicial)
  entrar.html        → criar conta / login
  avaliacao.html     → formulário de avaliação
  painel.html        → painel do aluno
  admin.html         → área da personal
  css/styles.css     → visual (cores em :root no topo do arquivo)
  js/                → lógica de cada página
  manifest.webmanifest + sw.js → app instalável
```

## Próximas etapas sugeridas

- Treinos do aluno no app (montados pela personal no admin)
- Registro de evolução: medidas, fotos, cargas
- Agenda e lembretes
- Publicar online (Render, Railway, Fly.io ou uma VPS) com HTTPS e `COOKIE_SECURE=true`
