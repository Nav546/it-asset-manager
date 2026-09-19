FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching - only re-runs if package.json changes)
COPY package.json ./
RUN npm install --production

# Copy the rest of the source code
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]