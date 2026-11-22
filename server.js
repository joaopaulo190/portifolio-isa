// Servidor do site + app da Isabela Medeiros Personal Trainer
// Banco de dados: libSQL/SQLite
//   - no computador: arquivo data/app.db
//   - na internet (gratuito): Turso — defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PORT = Number(process.env.PORT) || 3000;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const SESSION_DAYS = 30;
const REMOTO = !!process.env.TURSO_DATABASE_URL;

// ---------------------------------------------------------------------------
// Banco de dados
// ---------------------------------------------------------------------------
let dbUrl = process.env.TURSO_DATABASE_URL;
if (!REMOTO) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  dbUrl = 'file:' + path.relative(process.cwd(), path.join(DATA_DIR, 'app.db')).replaceAll('\\', '/');
}
const db = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });

await db.executeMultiple(`
  ${REMOTO ? '' : 'PRAGMA journal_mode = WAL;'}

  CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    telefone    TEXT,
    senha_hash  TEXT NOT NULL,
    criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    token_hash  TEXT PRIMARY KEY,
    usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    papel       TEXT NOT NULL,
    expira_em   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS avaliacoes (
    usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    dados          TEXT NOT NULL DEFAULT '{}',
    etapa          INTEGER NOT NULL DEFAULT 0,
    concluida      INTEGER NOT NULL DEFAULT 0,
    atualizado_em  TEXT NOT NULL DEFAULT (datetime('now')),
    concluida_em   TEXT
  );

  CREATE TABLE IF NOT EXISTS avaliacoes_historico (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    dados       TEXT NOT NULL,
    enviada_em  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    chave  TEXT PRIMARY KEY,
    valor  TEXT NOT NULL
  );
`);

// Consulta preparada: q.nome.get(...) / .all(...) / .run(...)
function stmt(sql) {
  const exec = (args) => db.execute({ sql, args });
  return {
    get: async (...args) => (await exec(args)).rows[0] ?? null,
    all: async (...args) => (await exec(args)).rows,
    run: async (...args) => {
      const r = await exec(args);
      return { lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
    },
    sql,
  };
}

const q = {
  criarUsuario: stmt('INSERT INTO usuarios (nome, email, telefone, senha_hash) VALUES (?, ?, ?, ?)'),
  usuarioPorEmail: stmt('SELECT * FROM usuarios WHERE email = ?'),
  usuarioPorId: stmt('SELECT id, nome, email, telefone, criado_em FROM usuarios WHERE id = ?'),
  criarSessao: stmt('INSERT INTO sessoes (token_hash, usuario_id, papel, expira_em) VALUES (?, ?, ?, ?)'),
  sessao: stmt('SELECT * FROM sessoes WHERE token_hash = ? AND expira_em > ?'),
  apagarSessao: stmt('DELETE FROM sessoes WHERE token_hash = ?'),
  limparSessoes: stmt('DELETE FROM sessoes WHERE expira_em <= ?'),
  avaliacao: stmt('SELECT * FROM avaliacoes WHERE usuario_id = ?'),
  salvarAvaliacao: stmt(`
    INSERT INTO avaliacoes (usuario_id, dados, etapa, atualizado_em) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(usuario_id) DO UPDATE SET dados = excluded.dados, etapa = excluded.etapa, atualizado_em = datetime('now')
  `),
  concluirAvaliacao: stmt(`UPDATE avaliacoes SET concluida = 1, concluida_em = datetime('now') WHERE usuario_id = ?`),
  addHistorico: stmt('INSERT INTO avaliacoes_historico (usuario_id, dados) VALUES (?, ?)'),
  historico: stmt('SELECT id, dados, enviada_em FROM avaliacoes_historico WHERE usuario_id = ? ORDER BY id DESC'),
  listarAlunos: stmt(`
    SELECT u.id, u.nome, u.email, u.telefone, u.criado_em,
           a.concluida, a.etapa, a.atualizado_em, a.concluida_em, a.dados
    FROM usuarios u LEFT JOIN avaliacoes a ON a.usuario_id = u.id
    ORDER BY u.criado_em DESC
  `),
  config: stmt('SELECT valor FROM config WHERE chave = ?'),
  salvarConfig: stmt('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'),
};

// ---------------------------------------------------------------------------
// Senha da área administrativa
//   1) variável ADMIN_PASSWORD  2) senha já gerada antes  3) gera uma nova
// ---------------------------------------------------------------------------
async function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const salva = await q.config.get('senha_admin');
  if (salva) return salva.valor;
  const arquivo = path.join(DATA_DIR, 'senha-admin.txt'); // compatibilidade com a versão anterior
  const senha = !REMOTO && fs.existsSync(arquivo)
    ? fs.readFileSync(arquivo, 'utf8').trim()
    : crypto.randomBytes(9).toString('base64url');
  await q.salvarConfig.run('senha_admin', senha);
  return senha;
}
const ADMIN_PASSWORD = await getAdminPassword();

// ---------------------------------------------------------------------------
// Utilitários de segurança
// ---------------------------------------------------------------------------
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function conferirSenha(senha, armazenado) {
  const [, salt, hash] = armazenado.split('$');
  const calc = crypto.scryptSync(senha, salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === calc.length && crypto.timingSafeEqual(ref, calc);
}

function compararTexto(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function novaSessao(res, usuarioId, papel) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = Date.now() + SESSION_DAYS * 864e5;
  await q.criarSessao.run(sha256(token), usuarioId, papel, expira);
  const nomeCookie = papel === 'admin' ? 'admin_sid' : 'sid';
  res.setHeader('Set-Cookie', cookie(nomeCookie, token, SESSION_DAYS * 86400));
}

function cookie(nome, valor, maxAge) {
  return `${nome}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${COOKIE_SECURE ? '; Secure' : ''}`;
}

function lerCookies(req) {
  const out = {};
  for (const parte of (req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return out;
}

async function sessaoAtual(req, papel) {
  const token = lerCookies(req)[papel === 'admin' ? 'admin_sid' : 'sid'];
  if (!token) return null;
  const s = await q.sessao.get(sha256(token), Date.now());
  return s && s.papel === papel ? { ...s, token } : null;
}

// Limite simples de tentativas de login (por IP)
const tentativas = new Map();
function bloqueado(ip) {
  const agora = Date.now();
  const t = tentativas.get(ip) || { n: 0, desde: agora };
  if (agora - t.desde > 15 * 60e3) { t.n = 0; t.desde = agora; }
  t.n++;
  tentativas.set(ip, t);
  return t.n > 20;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limparTexto(v, max = 200) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// Aceita apenas campos simples e de tamanho limitado na avaliação
function limparDados(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return {};
  const out = {};
  for (const [k, v] of Object.entries(dados).slice(0, 120)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 2000);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string').slice(0, 30).map((x) => x.slice(0, 200));
  }
  return out;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers['content-type'] || '').includes('application/json')) {
      return reject(Object.assign(new Error('Envie os dados em JSON.'), { status: 415 }));
    }
    let tamanho = 0;
    const partes = [];
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > 200_000) { reject(Object.assign(new Error('Dados grandes demais.'), { status: 413 })); req.destroy(); }
      else partes.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function resumoAvaliacao(row) {
  if (!row) return { etapa: 0, concluida: false, atualizado_em: null, concluida_em: null };
  return { etapa: row.etapa, concluida: !!row.concluida, atualizado_em: row.atualizado_em, concluida_em: row.concluida_em };
}

// ---------------------------------------------------------------------------
// Rotas da API
// ---------------------------------------------------------------------------
async function api(req, res, url) {
  const rota = `${req.method} ${url.pathname}`;
  // Atrás de um servidor de hospedagem (proxy), o IP real vem no cabeçalho X-Forwarded-For
  const ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;

  // --- Cadastro ---
  if (rota === 'POST /api/cadastro') {
    const b = await lerJson(req);
    const nome = limparTexto(b.nome, 100);
    const email = limparTexto(b.email, 160).toLowerCase();
    const telefone = limparTexto(b.telefone, 30);
    const senha = typeof b.senha === 'string' ? b.senha : '';
    if (nome.length < 2) return json(res, 400, { erro: 'Informe seu nome completo.' });
    if (!EMAIL_RE.test(email)) return json(res, 400, { erro: 'E-mail inválido.' });
    if (senha.length < 8) return json(res, 400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });
    if (await q.usuarioPorEmail.get(email)) return json(res, 409, { erro: 'Já existe uma conta com este e-mail. Faça login.' });
    const { lastInsertRowid } = await q.criarUsuario.run(nome, email, telefone, hashSenha(senha));
    await novaSessao(res, Number(lastInsertRowid), 'aluno');
    return json(res, 201, { usuario: await q.usuarioPorId.get(lastInsertRowid) });
  }

  // --- Login ---
  if (rota === 'POST /api/login') {
    if (bloqueado(ip)) return json(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    const b = await lerJson(req);
    const email = limparTexto(b.email, 160).toLowerCase();
    const u = await q.usuarioPorEmail.get(email);
    if (!u || !conferirSenha(String(b.senha || ''), u.senha_hash)) {
      return json(res, 401, { erro: 'E-mail ou senha incorretos.' });
    }
    await novaSessao(res, u.id, 'aluno');
    return json(res, 200, { usuario: await q.usuarioPorId.get(u.id), avaliacao: resumoAvaliacao(await q.avaliacao.get(u.id)) });
  }

  // --- Logout (aluno ou admin) ---
  if (rota === 'POST /api/logout') {
    const c = lerCookies(req);
    for (const t of [c.sid, c.admin_sid]) if (t) await q.apagarSessao.run(sha256(t));
    res.setHeader('Set-Cookie', [cookie('sid', '', 0), cookie('admin_sid', '', 0)]);
    return json(res, 200, { ok: true });
  }

  // --- Rotas da área do aluno ---
  if (url.pathname === '/api/eu' || url.pathname === '/api/avaliacao') {
    const s = await sessaoAtual(req, 'aluno');
    if (!s) return json(res, 401, { erro: 'Faça login para continuar.' });
    const usuario = await q.usuarioPorId.get(s.usuario_id);
    if (!usuario) return json(res, 401, { erro: 'Conta não encontrada.' });

    if (rota === 'GET /api/eu') {
      return json(res, 200, { usuario, avaliacao: resumoAvaliacao(await q.avaliacao.get(usuario.id)) });
    }

    if (rota === 'GET /api/avaliacao') {
      const a = await q.avaliacao.get(usuario.id);
      return json(res, 200, { ...resumoAvaliacao(a), dados: a ? JSON.parse(a.dados) : {} });
    }

    if (rota === 'PUT /api/avaliacao') {
      const b = await lerJson(req);
      const dados = limparDados(b.dados);
      const etapa = Math.max(0, Math.min(20, Number(b.etapa) || 0));
      if (b.concluir && dados.consentimento !== true) {
        return json(res, 400, { erro: 'É preciso confirmar o termo de responsabilidade para enviar.' });
      }
      const texto = JSON.stringify(dados);
      const comandos = [{ sql: q.salvarAvaliacao.sql, args: [usuario.id, texto, etapa] }];
      if (b.concluir) {
        comandos.push({ sql: q.concluirAvaliacao.sql, args: [usuario.id] });
        comandos.push({ sql: q.addHistorico.sql, args: [usuario.id, texto] });
      }
      await db.batch(comandos, 'write'); // tudo ou nada
      return json(res, 200, resumoAvaliacao(await q.avaliacao.get(usuario.id)));
    }
  }

  // --- Área da personal (admin) ---
  if (rota === 'POST /api/admin/login') {
    if (bloqueado(ip)) return json(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    const b = await lerJson(req);
    if (!compararTexto(b.senha || '', ADMIN_PASSWORD)) return json(res, 401, { erro: 'Senha incorreta.' });
    await novaSessao(res, null, 'admin');
    return json(res, 200, { ok: true });
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!(await sessaoAtual(req, 'admin'))) return json(res, 401, { erro: 'Acesso restrito.' });

    if (rota === 'GET /api/admin/alunos') {
      const alunos = (await q.listarAlunos.all()).map((r) => {
        const d = r.dados ? JSON.parse(r.dados) : {};
        return {
          id: r.id, nome: r.nome, email: r.email, telefone: r.telefone, criado_em: r.criado_em,
          concluida: !!r.concluida, etapa: r.etapa ?? 0, atualizado_em: r.atualizado_em, concluida_em: r.concluida_em,
          objetivo: d.objetivo || null,
        };
      });
      return json(res, 200, { alunos });
    }

    const m = url.pathname.match(/^\/api\/admin\/alunos\/(\d+)$/);
    if (m && req.method === 'GET') {
      const usuario = await q.usuarioPorId.get(Number(m[1]));
      if (!usuario) return json(res, 404, { erro: 'Aluno não encontrado.' });
      const a = await q.avaliacao.get(usuario.id);
      return json(res, 200, {
        usuario,
        avaliacao: { ...resumoAvaliacao(a), dados: a ? JSON.parse(a.dados) : {} },
        historico: (await q.historico.all(usuario.id)).map((h) => ({ ...h, dados: JSON.parse(h.dados) })),
      });
    }
  }

  return json(res, 404, { erro: 'Rota não encontrada.' });
}

// ---------------------------------------------------------------------------
// Arquivos estáticos (site + app)
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.apk': 'application/vnd.android.package-archive',
};

function estatico(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  else if (!path.extname(rel)) rel += '.html';           // /entrar -> entrar.html
  const arquivo = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!arquivo.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }

  fs.readFile(arquivo, (err, conteudo) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Página não encontrada</h1><p><a href="/">Voltar ao início</a></p>');
    }
    const ext = path.extname(arquivo);
    if (ext === '.html') {
      // Endereço completo do site (para a prévia do link no WhatsApp)
      const proto = req.headers['x-forwarded-proto'] || (COOKIE_SECURE ? 'https' : 'http');
      const host = String(req.headers.host || 'localhost').replace(/[^\w.:-]/g, '');
      conteudo = conteudo.toString('utf8').replaceAll('%ORIGIN%', `${proto}://${host}`);
    }
    if (ext === '.apk') res.setHeader('Content-Disposition', 'attachment; filename="isabela-medeiros.apk"');
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache', // sempre confere se há versão nova (alterações aparecem na hora)
    });
    res.end(conteudo);
  });
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");

  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    estatico(req, res, url);
  } catch (e) {
    if (e.status) return json(res, e.status, { erro: e.message });
    if (/UNIQUE constraint failed: usuarios\.email/.test(e.message)) {
      return json(res, 409, { erro: 'Já existe uma conta com este e-mail. Faça login.' });
    }
    console.error(e);
    json(res, 500, { erro: 'Erro interno. Tente novamente.' });
  }
});

setInterval(() => q.limparSessoes.run(Date.now()).catch(() => {}), 3600e3).unref();

server.listen(PORT, () => {
  console.log(`\n  ✔ Site rodando em  http://localhost:${PORT}`);
  console.log(`  ✔ Área da personal: http://localhost:${PORT}/admin`);
  console.log(`  ✔ Banco de dados: ${REMOTO ? 'Turso (nuvem)' : 'arquivo local data/app.db'}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`  ⚠ Senha do admin (gerada automaticamente): ${ADMIN_PASSWORD}`);
    console.log('    Para escolher a sua, defina a variável ADMIN_PASSWORD.');
  }
  console.log('');
});
