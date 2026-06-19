FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production
WORKDIR /app
COPY . .
EXPOSE 3005
CMD ["node", "server/index.js"]
