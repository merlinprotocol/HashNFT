/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("hardhat-deploy");
require('hardhat-deploy-ethers');

const dotenv = require('dotenv');
const result = dotenv.config();
if (result.error) {
  throw result.error;
}

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    timeout: 100000000
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    administrator: {
      default: 1,
    },
    issuer: {
      default: 2,
    },
    proposer: {
      default: 3,
    },
    executor: {
      default: 4,
    },
    user: {
      default: 5,
    },
    vault: {
      default: 6,
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    goerli: {
      url: "https://eth.getblock.io/f899d576-ba45-4a43-9c82-14a9ca6b15dc/goerli/",
      chainId: 5,
      accounts: [process.env.deployer],
      gas: 3100000,
      gasPrice: 8000000000,
    },
  },
  etherscan: {
    apiKey: {
      goerli: process.env.apikey
    },
    customChains: [
      {
        network: "goerli",
        chainId: 5,
        urls: {
          apiURL: "http://api-goerli.etherscan.io",
          browserURL: "https://goerli.etherscan.io"
        }
      }
    ]
  }
};
