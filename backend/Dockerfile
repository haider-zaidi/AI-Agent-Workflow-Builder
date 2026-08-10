# Dev-oriented image: installs deps once, then runs tsx watch against a
# volume-mounted src/ for hot reload. Not used for the source of truth on
# `npm run build`/production - see README for deploying backend/ elsewhere.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4001

CMD ["npm", "run", "dev"]
