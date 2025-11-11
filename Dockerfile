# Multi-service Dockerfile for CI/CD
# Can build either api-gateway or user-service based on SERVICE_NAME build arg

ARG SERVICE_NAME=api-gateway

# Base image
FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig*.json ./

# Install dependencies
FROM base AS dependencies
RUN npm ci --only=production
RUN cp -R node_modules /tmp/node_modules
RUN npm ci

# Build stage - builds the specified service
FROM base AS build
ARG SERVICE_NAME
COPY --from=dependencies /app/node_modules ./node_modules
COPY apps/${SERVICE_NAME} ./apps/${SERVICE_NAME}
COPY libs ./libs
RUN npm run build:${SERVICE_NAME}

# Production image
FROM node:20-alpine AS production
ARG SERVICE_NAME

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy only necessary files
COPY --from=dependencies /tmp/node_modules ./node_modules
COPY --from=build /app/dist/apps/${SERVICE_NAME} ./dist
COPY package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose default port (can be overridden)
EXPOSE 3000

# Start the application
CMD ["dumb-init", "node", "dist/main"]
