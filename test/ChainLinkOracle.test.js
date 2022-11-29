// test/Project.test.js
// Load dependencies
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const {ethers} = require('hardhat');


// Start test
describe('ChainLinkOracle', function () {

    this.chainLinkOracle = null
    beforeEach(async function () {
        const ChainLinkOracleContractFactory = await ethers.getContractFactory("ChainLinkOracle")
        // this.chainLinkOracle = await ChainLinkOracleContractFactory.deploy();
        // await this.chainLinkOracle.deployed();
    });

    // Test constructor
    it('test create', async function () {
    });

});
