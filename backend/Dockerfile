FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dev
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS prod
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json .
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
