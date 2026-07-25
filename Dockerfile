FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile=false --prod

COPY . .

ENV PORT=4173
EXPOSE 4173

CMD ["node", "server.mjs"]
