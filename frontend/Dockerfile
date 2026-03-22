FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.docker.conf /tmp/nginx.docker.conf.template
COPY docker-entrypoint-frontend.sh /docker-entrypoint-frontend.sh
RUN chmod +x /docker-entrypoint-frontend.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint-frontend.sh"]
