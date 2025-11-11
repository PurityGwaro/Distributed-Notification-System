# Base image
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig.json ./

# Install dependencies
FROM base AS dependencies
RUN npm ci --only=production
RUN cp -R node_modules /tmp/node_modules
RUN npm ci

# Build the application
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY apps/api-gateway ./apps/api-gateway
COPY libs ./libs
RUN npm run build:api-gateway

# Production image
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy only necessary files
COPY --from=dependencies /tmp/node_modules ./node_modules
COPY --from=build /app/dist/apps/api-gateway ./dist
COPY package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["dumb-init", "node", "dist/main"]
