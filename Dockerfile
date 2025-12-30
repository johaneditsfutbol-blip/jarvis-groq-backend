FROM node:20-slim

# Instalar dependencias del sistema (FFmpeg es vital)
RUN apt-get update && apt-get install -y ffmpeg python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD [ "node", "server.js" ]
