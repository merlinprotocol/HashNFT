/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-etherscan");
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
        details: {
          yul: false
        }
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
    eth: {
      url: "https://eth.getblock.io/f899d576-ba45-4a43-9c82-14a9ca6b15dc/mainnet/",
      accounts: [process.env.deployer],
      allowUnlimitedContractSize: true,
    },
    goerli: {
      url: "https://rpc.ankr.com/eth_goerli",
      chainId: 5,
      accounts: [process.env.deployer],
      gas: 5000000, //units of gas you are willing to pay, aka gas limit
      gasPrice:  50000000000,
      allowUnlimitedContractSize: true,
    },
  },
  etherscan: {
    apiKey: "66PX9UR5WY4783WI278HJDCM88XJ7J8MFY",
  },
};
