FROM node:18

WORKDIR /app
ENV PATH=/app/node_modules/.bin:$PATH

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN mkdir -p conf \
 && [ -f conf/config.json ] || echo '{}' > conf/config.json

RUN npm install -g grunt-cli \
 && grunt build:prod

# ✅ FIXED plugin build
RUN mkdir -p /app/default-plugins/content \
 && cd /app/default-plugins/content \
 && npm init -y \
 && npm install --legacy-peer-deps \
    git+https://github.com/adaptlearning/adapt-contrib-text.git \
    git+https://github.com/adaptlearning/adapt-contrib-mcq.git

RUN mkdir -p /app/storage/conf \
 && [ -f /app/storage/conf/config.json ] || echo '{}' > /app/storage/conf/config.json

EXPOSE 5000
CMD ["npm", "start"]