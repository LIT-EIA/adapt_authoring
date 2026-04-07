FROM node:18

WORKDIR /app
ENV PATH=/app/node_modules/.bin:$PATH

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm install -g grunt-cli \
 && grunt build:prod

RUN mkdir -p /app/storage/conf \
 && [ -f /app/storage/conf/config.json ] || echo '{}' > /app/storage/conf/config.json

EXPOSE 5000
CMD ["npm", "start"]