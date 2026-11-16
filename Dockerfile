FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p public/uploads
EXPOSE 3000
CMD ["sh", "-c", "npm run db:init && npm run db:seed && npm start"]
