FROM node:24-alpine3.24 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine3.24 AS production-dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
