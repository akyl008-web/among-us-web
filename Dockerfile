# Production image: builds shared + server + client, serves everything from one Node process.
#   docker compose up --build
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/prisma.config.ts server/
COPY server/prisma server/prisma
COPY client/package.json client/
COPY scripts scripts
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    SERVE_CLIENT=true \
    HOST=0.0.0.0 \
    PORT=3001
COPY --from=build /app /app
USER node
EXPOSE 3001
# Apply pending migrations when a database is configured, then start.
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then npm run db:deploy -w @stellar/server; fi && npm start"]
