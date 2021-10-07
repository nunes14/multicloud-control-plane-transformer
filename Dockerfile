# syntax=docker/dockerfile:1.3-labs
FROM node:14 as build

RUN npm install -g npm

# capture dependencies
WORKDIR /app
COPY package* ./
RUN --mount=type=cache,target=/root/.npm npm install --ignore-scripts

# compile and build an npm package
COPY . .
RUN <<EOF
mkdir /artifacts
npm pack . --pack-destination /artifacts
EOF

# use a slim base for the runtime image
FROM node:14-slim as app
WORKDIR /app

RUN <<EOF
apt-get update
apt-get install -y git
EOF

COPY --from=build /artifacts/*.tgz /artifacts/
RUN npm install -g /artifacts/*.tgz

ENTRYPOINT ["transformer"]
