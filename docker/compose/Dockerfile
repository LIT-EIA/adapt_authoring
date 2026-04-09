FROM node:22
ENV PATH=/node_modules/.bin:$PATH
WORKDIR /app/storage/
COPY package.json .
RUN npm install
COPY . .
RUN [ -f conf/config.json ] || mkdir -p conf && echo '{}' > conf/config.json
RUN npm install -g grunt-cli
RUN grunt build:prod
ENTRYPOINT ["npm", "start"]
