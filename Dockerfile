FROM node:18-alpine AS dev-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine AS prod-stage
WORKDIR /app

COPY --from=dev-stage /app/dist ./dist/
COPY server.js ./server.js
COPY package.json ./package.json

ENV NODE_ENV=production

RUN npm install express

EXPOSE 8006
CMD ["node", "server.js"]
