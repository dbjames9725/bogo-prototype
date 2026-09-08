# Use official Playwright Node.js image with Linux Chromium binaries pre-installed
FROM mcr.microsoft.com/playwright:v1.41.2-jammy

# Set working directory inside container
WORKDIR /app

# Copy dependency files first for layer caching
COPY package*.json ./

# Install dependencies inside Linux container
RUN npm ci

# Copy the entire project context
COPY . .

# Expose Express server port
EXPOSE 3001

# Start worker using ts-node
CMD ["npx", "ts-node", "--transpile-only", "worker/server.ts"]
