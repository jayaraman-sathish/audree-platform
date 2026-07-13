FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "npm run build && npm run preview -- --host 0.0.0.0 --port ${PORT:-5173}"]

