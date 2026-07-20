FROM node:22-slim AS dependencies

WORKDIR /app

# Build tools provide a fallback when a prebuilt better-sqlite3 binary is unavailable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-slim

WORKDIR /app

COPY . .
COPY --from=dependencies /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
EXPOSE 3000

CMD ["node", "--max-old-space-size=128", "server.js"]
