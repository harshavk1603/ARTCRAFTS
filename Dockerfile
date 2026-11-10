# ARTCRAFTS Backend API – Production Container
# Frontend is deployed separately on Vercel

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_FRONTEND=0
# Render injects PORT at runtime; 10000 is only a local default.
ENV PORT=10000

# Install production dependencies only (pg). The frontend is built by Vercel.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source, Supabase schema, and seed data
COPY server ./server
COPY supabase ./supabase
COPY src/data ./src/data

# Uploads is the only writable runtime path (Supabase Storage is preferred).
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 10000

CMD ["node", "server/index.mjs"]
