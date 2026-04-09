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

EXPOSE 5000
CMD ["npm", "start"]