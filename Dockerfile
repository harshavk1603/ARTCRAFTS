# ARTCRAFTS Backend API – Production Container
# Frontend is deployed separately on Vercel

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm ci

# Copy server source and seed data
COPY server ./server
COPY src/data ./src/data

# Ensure data and uploads directories exist
RUN mkdir -p data uploads && chmod 755 data uploads

EXPOSE 10000

CMD ["node", "server/index.mjs"]
