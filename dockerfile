# ---------------------------
# Base image (stable LTS)
# ---------------------------
FROM node:18-alpine

# ---------------------------
# App root
# ---------------------------
WORKDIR /app

# ---------------------------
# Ensure local binaries are usable
# ---------------------------
ENV PATH=/app/node_modules/.bin:$PATH

# ---------------------------
# Install dependencies
# ---------------------------
COPY package.json package-lock.json* ./
RUN npm install

# ---------------------------
# Copy app source
# ---------------------------
COPY . .

# ---------------------------
# Build step (as in old image)
# ---------------------------
RUN npm install -g grunt-cli && grunt build:prod

# ---------------------------
# Prepare runtime storage dir
# (PVC will mount here)
# ---------------------------
RUN mkdir -p /app/storage/conf \
 && [ -f /app/storage/conf/config.json ] || echo '{}' > /app/storage/conf/config.json

# ---------------------------
# Expose app port
# ---------------------------
EXPOSE 5000

# ---------------------------
# Run the app
# ---------------------------
CMD ["npm", "start"]