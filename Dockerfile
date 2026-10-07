# syntax=docker/dockerfile:1

FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN rm -rf internal/static/dist
COPY --from=web /web/dist internal/static/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/cellar .
# Empty data dir, owned by the nonroot user, to hold the SQLite file.
RUN mkdir /out/data && chown 65532:65532 /out/data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/cellar /cellar
COPY --from=build --chown=65532:65532 /out/data /data
ENV PORT=8080 DB_PATH=/data/cellar.db
EXPOSE 8080
USER 65532:65532
ENTRYPOINT ["/cellar"]
