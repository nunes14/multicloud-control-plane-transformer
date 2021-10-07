# build with dev dependencies
FROM node:16-bullseye as build

RUN npm install -g npm

# capture dependencies
WORKDIR /app
COPY package* ./
RUN --mount=type=cache,target=/root/.npm npm install --ignore-scripts

# compile and build an npm package
COPY . .
RUN mkdir /artifacts \
  && npm pack . --pack-destination /artifacts

# use a slim base for the runtime image
# sparse-checkout needs git version 2.25.0+, which is available starting in bullseye
FROM node:16-bullseye-slim as app
WORKDIR /app

# sparse-checkout needs git version 2.25.0+
RUN apt-get update \
  && apt-get install -y git \
  && rm -rf /var/lib/apt/lists/*

# install the app
COPY --from=build /artifacts/*.tgz /artifacts/
RUN npm install -g /artifacts/*.tgz

ENTRYPOINT ["transformer"]
