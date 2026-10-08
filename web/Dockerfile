FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Caddy built from source on the latest Go with the latest security-sensitive
# libraries, the same recipe as the shared proxy in the infra repo. The official
# Caddy image lags behind Go's security releases.
FROM golang:1.27-alpine AS caddy
# The pipeline passes today's date so this stage (and "@latest") re-runs once a
# day instead of being served from the build cache forever.
ARG REFRESH=local
WORKDIR /src
COPY caddy/main.go ./
RUN echo "refresh: $REFRESH" \
 && go mod init xove/caddy \
 && go get github.com/caddyserver/caddy/v2@v2.11 \
      golang.org/x/crypto@latest golang.org/x/net@latest golang.org/x/text@latest \
      google.golang.org/grpc@latest github.com/go-chi/chi/v5@latest \
      github.com/klauspost/compress@latest \
 && go mod tidy \
 && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /caddy . \
 && apk add --no-cache libcap \
 && setcap cap_net_bind_service=+ep /caddy

FROM caddy:2-alpine
# Pick up Alpine security fixes released after the base image was built, swap in
# our Caddy (allowed to bind port 80 without root, see setcap above) and run as a
# non-root user.
RUN apk upgrade --no-cache \
 && adduser -S -D -H -u 1000 -s /sbin/nologin web \
 && chown -R web /config /data
COPY --from=caddy /caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
USER web
