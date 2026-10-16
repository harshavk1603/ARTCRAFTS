# Stage 1: Build the Vite frontend application
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production runtime with native SQLite (node:sqlite)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3001
ENV PORT=3001

# Copy package descriptors and install only production dependencies (if any)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy build output, server modules, and initial data
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src/data ./src/data

# Ensure data and uploads directories exist with proper write permissions
RUN mkdir -p data uploads && chmod 777 data uploads

EXPOSE 3001

CMD ["node", "server/index.mjs"]
