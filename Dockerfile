# From https://pnpm.io/fr/docker#example-2-build-multiple-docker-images-in-a-monorepo

FROM node:22-alpine AS base
RUN apk add --no-cache git
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@9 --activate

FROM base AS build_base
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /usr/src/app/

COPY Common/ /usr/src/app/Common/
WORKDIR /usr/src/app/Common
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "common" install --frozen-lockfile --ignore-scripts
RUN pnpm run build

COPY Data/ /usr/src/app/Data/
WORKDIR /usr/src/app/Data
# Cannot ignore scripts : RAPTOR build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "data" install --frozen-lockfile
# 'prepare' script should have already built
# RUN pnpm run build

COPY Compute/ /usr/src/app/Compute/
WORKDIR /usr/src/app/Compute
# Cannot ignore scripts : Dijkstra build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "compute" install --frozen-lockfile || true
# 'prepare' script should have already built
# RUN pnpm run build

COPY Server/ /usr/src/app/Server/
WORKDIR /usr/src/app/Server
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "server" install --frozen-lockfile --ignore-scripts
RUN pnpm run compile

# 2nd build try, will work
WORKDIR /usr/src/app/Compute
RUN pnpm run build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm deploy --filter=server --prod /prod/server

FROM build_base AS build_client
COPY Client/ /usr/src/app/Client/
WORKDIR /usr/src/app/Client
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm -F "client" install --frozen-lockfile
# Set API URL/path, alias
ARG EXTERNAL_API_URL
ARG EXTERNAL_API_PATH
ENV VITE_API_URL ${EXTERNAL_API_URL}
ENV VITE_API_PATH ${EXTERNAL_API_PATH}
# Might need https://vite.dev/guide/build#public-base-path
RUN pnpm run build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm deploy --filter=client --prod /prod/client --ignore-scripts

FROM base AS server
ENV NODE_ENV=production
COPY --from=build_base /prod/server /prod/server
WORKDIR /prod/server
CMD [ "pnpm", "start" ]

FROM busybox:latest AS client
ENV NODE_ENV=production
COPY --from=build_client /prod/client/dist /prod/client
# From https://dev.to/code42cate/how-to-dockerize-vite-44d3
WORKDIR /prod/client
CMD ["busybox", "httpd", "-f", "-p", "8080"]