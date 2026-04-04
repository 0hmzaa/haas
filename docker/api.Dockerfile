FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api prisma:generate
EXPOSE 4000
CMD ["pnpm", "--filter", "api", "dev"]
