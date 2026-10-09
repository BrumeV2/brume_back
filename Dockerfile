FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# --- Dev : hot reload ---
FROM base AS dev
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# --- Build ---
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- Prod : image légère, sans devDependencies ---
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]