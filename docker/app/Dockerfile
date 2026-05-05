# syntax=docker/dockerfile:1.7

### 🔹 Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Ensure local binaries are in PATH
ENV PATH=/app/node_modules/.bin:$PATH

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies (deterministic)
RUN npm ci

# Copy application source
COPY . .

# Ensure config exists
RUN mkdir -p conf \
    && [ -f conf/config.json ] || echo '{}' > conf/config.json

# Install grunt locally (not globally)
RUN npm install grunt-cli

# Build application
RUN npx grunt build:prod



### 🔹 Runtime stage
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PATH=/app/node_modules/.bin:$PATH

# Copy built app from build stage
COPY --from=build /app /app

# Fix permissions for non-root execution
RUN chown -R node:node /app

# Drop privileges
USER node

# Expose app port
EXPOSE 5000

# Start application
CMD ["npm", "start"]