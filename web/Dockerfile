FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx serves static files with a small attack surface and runs as a non-root user.
FROM nginxinc/nginx-unprivileged:alpine
USER root
# Pick up Alpine security fixes released after the base image was built.
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
