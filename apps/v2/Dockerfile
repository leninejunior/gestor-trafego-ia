FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start"]
