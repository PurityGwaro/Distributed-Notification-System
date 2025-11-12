# 1. Use official Node LTS image
FROM node:20-alpine

# 2. Set working directory
WORKDIR /app

# 3. Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# 4. Install dependencies
RUN npm install --production

# 5. Copy source code
COPY . .

# 6. Build TypeScript
RUN npm run build

# 7. Expose port 3000
EXPOSE 3000

# 8. Run the app
CMD ["node", "dist/main.js"]
