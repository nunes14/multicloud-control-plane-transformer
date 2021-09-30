# syntax=docker/dockerfile:1.3-labs
FROM node:14 as build

# capture dependencies
WORKDIR /app
COPY package* ./
RUN --mount=type=cache,target=/root/.npm npm install --ignore-scripts

COPY . .
RUN npm run compile

# use a slim base for the runtime image
FROM node:14-slim as app
WORKDIR /app
COPY package* ./
RUN --mount=type=cache,target=/root/.npm npm install --production --ignore-scripts
COPY --from=build /app/build /app/build
ENTRYPOINT ["node", "/app/build/src/cli.js"]
