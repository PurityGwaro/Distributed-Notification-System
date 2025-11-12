# Base image for dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && \
    cp -R node_modules /tmp/node_modules && \
    npm ci

# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
COPY test ./test
RUN npm run build

# Production image
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=dependencies /tmp/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
EXPOSE 3000
CMD ["dumb-init", "node", "dist/main"]
