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
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  }
};
