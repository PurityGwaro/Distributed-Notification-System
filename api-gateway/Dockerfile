# Use Node.js 20 (newer and faster than 18)
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy only package files first (for caching)
COPY package*.json ./

# Install all dependencies (include dev for build)
RUN npm ci

# Copy rest of the code
COPY . .

# Explicitly install Nest CLI in case it’s needed for build
RUN npm install -g @nestjs/cli

# Build the NestJS app
RUN npm run build

# Expose the correct port
EXPOSE 3004

# Start the production build
CMD ["npm", "run", "start:prod"]
