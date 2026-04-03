FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web ./apps/web
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
