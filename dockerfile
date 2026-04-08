# ============================
# Base image (matches legacy behavior)
# ============================
FROM node:18

# ============================
# Application root
# ============================
WORKDIR /app

# Ensure local node binaries are on PATH
ENV PATH=/app/node_modules/.bin:$PATH

# ============================
# Copy dependency manifests FIRST
# (this layer MUST include package.json)
# ============================
COPY package.json package-lock.json* ./

# Install all deps (Grunt needs dev deps)
RUN npm install

# ============================
# Copy the rest of the app source
# ============================
COPY . .

# ============================
# Ensure Grunt config exists BEFORE build
# (matches legacy Dockerfile behavior)
# ============================
RUN mkdir -p conf \
 && [ -f conf/config.json ] || echo '{}' > conf/config.json

# ============================
# Build the app (legacy requirement)
# ============================
RUN npm install -g grunt-cli \
 && grunt build:prod

# ============================
# ✅ FIX: Build Adapt plugins at IMAGE BUILD TIME
# (NO runtime npm installs in Kubernetes)
# ============================
RUN mkdir -p /app/default-plugins/content \
 && cd /app/default-plugins/content \
 && npm init -y \
 && npm install adapt-contrib-text adapt-contrib-mcq

# ============================
# Prepare runtime storage path
# (PVC mounts here in Kubernetes)
# NOTE: plugins will be COPIED here by initContainer
# ============================
RUN mkdir -p /app/storage/conf \
 && [ -f /app/storage/conf/config.json ] || echo '{}' > /app/storage/conf/config.json

# ============================
# Expose app port
# ============================
EXPOSE 5000

# ============================
# Start the app
# ============================
CMD ["npm", "start"]