FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/erp-api ./cmd/api

FROM alpine:3.20
RUN addgroup -S erp && adduser -S erp -G erp
WORKDIR /app
COPY --from=build /out/erp-api /app/erp-api
USER erp
EXPOSE 8080
ENTRYPOINT ["/app/erp-api"]
