FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3-qrcode && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json lib.mjs market.mjs server.mjs ./
COPY scripts ./scripts
COPY public ./public
RUN mkdir -p data uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node","server.mjs"]
