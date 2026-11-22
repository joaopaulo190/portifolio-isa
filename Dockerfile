# Imagem para publicar o site + API (Render, Railway, Fly.io, VPS...)
FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production \
    PORT=3000 \
    COOKIE_SECURE=true \
    TRUST_PROXY=true

# Banco de dados: defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN (gratuito em turso.tech).
# Sem elas, usa um arquivo local em /app/data (só use assim com disco persistente).
EXPOSE 3000
CMD ["node", "server.js"]
