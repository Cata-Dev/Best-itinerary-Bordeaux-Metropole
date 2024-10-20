# From https://pnpm.io/fr/docker#example-2-build-multiple-docker-images-in-a-monorepo

FROM node:18-alpine AS base
RUN apk add --no-cache git
# ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build_base
COPY . /usr/src/app

WORKDIR /usr/src/app/Common
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "common" install --frozen-lockfile
RUN pnpm run build

WORKDIR /usr/src/app/Data
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "data" install --frozen-lockfile
RUN pnpm run build

WORKDIR /usr/src/app/Compute
# Will fail for the 1st time, but still emit required files to continue building
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "compute" install --frozen-lockfile || true
RUN pnpm run build || true

WORKDIR /usr/src/app/Server
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "server" install --frozen-lockfile
RUN pnpm run compile

# 2nd build try, will work
WORKDIR /usr/src/app/Compute
RUN pnpm run build

# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm add -g typescript
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm deploy --filter=server --prod /prod/server

FROM build_base AS build_client
WORKDIR /usr/src/app/Client
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "client" install --frozen-lockfile
# Set API URL/path, alias
ARG EXTERNAL_API_URL
ARG EXTERNAL_API_PATH
ENV VITE_API_URL ${EXTERNAL_API_URL}
ENV VITE_API_PATH ${EXTERNAL_API_PATH}
# Might need https://vite.dev/guide/build#public-base-path
RUN pnpm run build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm deploy --filter=client --prod /prod/client

FROM base AS server
COPY --from=build_base /prod/server /prod/server
WORKDIR /prod/server
CMD [ "pnpm", "start" ]

FROM busybox:latest AS client
COPY --from=build_client /prod/client/dist /prod/client
# From https://dev.to/code42cate/how-to-dockerize-vite-44d3
WORKDIR /prod/client
CMD ["busybox", "httpd", "-f", "-p", "8080"]