# LogiSuite TMS - Frontend Next.js (multi-stage, salida standalone)

# ---- Etapa 1: dependencias --------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- Etapa 2: build ---------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Estilo del mapa base (se incrusta en el bundle del cliente al compilar)
ARG NEXT_PUBLIC_MAP_STYLE=https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json
ENV NEXT_PUBLIC_MAP_STYLE=${NEXT_PUBLIC_MAP_STYLE}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Typecheck + build (prebuild copia el worker de MapLibre a public/vendor)
RUN npm run typecheck && npm run build

# ---- Etapa 3: ejecución -----------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_INTERNAL_URL=http://backend:8000

RUN addgroup -S -g 1001 nextjs && adduser -S -u 1001 -G nextjs nextjs

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/red >/dev/null || exit 1

CMD ["node", "server.js"]
