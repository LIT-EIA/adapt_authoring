FROM node:18

WORKDIR /app
ENV PATH=/app/node_modules/.bin:$PATH

# System deps often required by Grunt
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Ensure Grunt-required config exists BEFORE build
RUN mkdir -p conf \
 && [ -f conf/config.json ] || echo '{}' > conf/config.json

RUN npm install -g grunt-cli \
 && grunt build:prod

RUN mkdir -p /app/storage/conf \
 && [ -f /app/storage/conf/config.json ] || echo '{}' > /app/storage/conf/config.json

EXPOSE 5000
CMD ["npm", "start"]