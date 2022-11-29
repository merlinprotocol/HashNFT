FROM node:12-alpine

RUN apk add --no-cache git
RUN apk add --no-cache curl

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm install
RUN npx hardhat compile

COPY $PWD/docker/entrypoint.sh /usr/local/bin
ENTRYPOINT ["/bin/sh", "/usr/local/bin/entrypoint.sh"]