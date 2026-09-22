# syntax=docker/dockerfile:1.7

### 🔹 1. BUILD STAGE
FROM node:22-alpine AS build
WORKDIR /app

ENV PATH=/app/node_modules/.bin:$PATH

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Install dependencies first (better caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# ✅ Ensure config exists for build step
RUN mkdir -p conf \
    && [ -f conf/config.json ] || echo '{}' > conf/config.json

# ✅ Run build at image build time
RUN npx grunt build:translate

# ✅ Remove dev dependencies after build (very important)
RUN npm prune --omit=dev



### 🔹 2. RUNTIME STAGE
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PATH=/app/node_modules/.bin:$PATH

# Install only runtime dependency (if actually needed)
RUN apk add --no-cache git

# ✅ Copy only built app
COPY --from=build /app /app

# ✅ Fix ownership
RUN chown -R node:node /app

USER node

EXPOSE 5000

# ✅ IMPORTANT: remove grunt from runtime
CMD ["node", "server.js"]