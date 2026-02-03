# Use the offlicial node.js 18 image alphine linux as the base image
FROM node:18-alpine

WORKDIR /use/scr/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]