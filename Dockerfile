FROM node:20-slim

# 1. Instalar FFmpeg y Python3 + PIP
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    apt-get clean

# 2. Instalar el motor de voz Edge-TTS original (Python)
# Usamos --break-system-packages porque en Debian 12 es requerido, no te preocupes
RUN pip3 install edge-tts --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD [ "node", "server.js" ]
