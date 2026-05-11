FROM node:20-alpine AS base

# ── deps stage: install ALL dependencies ─────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
# prisma/schema.prisma is required by the postinstall hook (prisma generate)
COPY prisma ./prisma
RUN npm ci

# ── builder stage: compile the Next.js app ────────────────────────────────────
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXTAUTH_URL=https://accountant-taxlab-production.up.railway.app
ENV NEXTAUTH_SECRET=placeholder-build-only
# Dummy DB — only needed so Next.js can type-check Prisma imports at build time
ENV DATABASE_URL=postgresql://x:x@localhost:5432/x
ENV DIRECT_URL=postgresql://x:x@localhost:5432/x

# prisma generate + next build
RUN npm run build

# ── runner stage: minimal production image ────────────────────────────────────
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Prisma generated client (needed at runtime for DB queries)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma    ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma    ./node_modules/@prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
