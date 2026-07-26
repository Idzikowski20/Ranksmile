# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf data __tests__ __mocks__
RUN npm run build

# Stage 3: Production runner (web only — cron is a separate Railway service)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/email ./email
COPY --from=builder --chown=nextjs:nodejs /app/database ./database
COPY --from=builder --chown=nextjs:nodejs /app/.sequelizerc ./.sequelizerc
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh

# Runtime packages not reliably traced into standalone:
# - @googleapis/searchconsole: complex module resolution
# - sequelize-cli: entrypoint migrations
RUN chmod +x /app/entrypoint.sh && \
    rm -f package.json && npm init -y && \
    npm install --no-package-lock \
      dotenv@16.0.3 \
      @googleapis/searchconsole@1.0.5 \
      sequelize-cli@6.6.5 \
      @isaacs/ttlcache@1.4.1 && \
    npm cache clean --force && \
    rm -rf /tmp/* /root/.npm

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
