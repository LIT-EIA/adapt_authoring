# syntax=docker/dockerfile:1.7

### 🔹 Build stage
FROM node:22-alpine AS build
WORKDIR /app

ENV PATH=/app/node_modules/.bin:$PATH

# ✅ Install git (required by app)
RUN apk add --no-cache git

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN mkdir -p conf \
    && [ -f conf/config.json ] || echo '{}' > conf/config.json

RUN npm install grunt-cli

RUN npx grunt build:translate



### 🔹 Runtime stage
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PATH=/app/node_modules/.bin:$PATH

# ✅ Install git here too
RUN apk add --no-cache git

COPY --from=build /app /app

# ✅ Fix permissions
RUN chown -R node:node /app

USER node

EXPOSE 5000

CMD ["npm", "start"]