# Production image: installs deps, compiles TypeScript at build time (not on
# every container boot), then runs the compiled output directly.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 4001

CMD ["npm", "run", "start"]
