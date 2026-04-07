# =========================================
# Base image
# =========================================
FROM node:18-alpine

# =========================================
# Set working directory inside the container
# =========================================
WORKDIR /app

# =========================================
# Copy dependency manifests first (cache-friendly)
# =========================================
COPY package*.json ./

# =========================================
# Install dependencies
# Use npm ci for reproducible builds
# =========================================
RUN npm ci --only=production

# =========================================
# Copy application source code
# =========================================
COPY . .

# =========================================
# Create runtime storage directory
# (PVC will mount over this in Kubernetes)
# =========================================
RUN mkdir -p /app/storage

# =========================================
# Expose application port
# =========================================
EXPOSE 5000

# =========================================
# Default startup command
# =========================================
CMD ["npm", "start"]