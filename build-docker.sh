#!/bin/bash
docker build -t hardhat .
docker tag hardhat:latest easonzhao/hardhat:latest