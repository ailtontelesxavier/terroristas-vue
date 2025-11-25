# Build and serve the Vite app in production
FROM node:18-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install

# Copia código e gera build
COPY . .
RUN npm run build

# Entrypoint garante que o build exista antes de servir
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 4173
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
