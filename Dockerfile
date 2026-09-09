FROM mcr.microsoft.com/playwright:v1.41.2-jammy

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Expose server port
EXPOSE 3001

# Set port env
ENV PORT=3001

# Launch Playwright Express server
CMD ["npx", "tsx", "app/worker/server.ts"]
