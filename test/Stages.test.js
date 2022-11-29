// test/Project.test.js
// Load dependencies
const { expect } = require('chai');
const { BigNumber } = require('ethers');
// const { ethers } = require('hardhat');

const ONE_WEEK = BigNumber.from(3600 * 24 * 7)

// Start test
describe('Stages', function () {
    before( async function () {
        this.StagesContract = await ethers.getContractFactory("Stages");
    });

    this.beforeEach(async function () {
        const bestBlock = await network.provider.send('eth_getBlockByNumber', [await network.provider.send('eth_blockNumber', []), false]);
        this.startTime = BigNumber.from(bestBlock.timestamp).add(3600 * 1)
        this.raiseDuration = 3600 * 24 * 7
        this.internshipDuration = 3600 * 24 * 7 * 4
        this.contractDuraction = 3600 * 24 * 7 * 52
        this.stages = await this.StagesContract.deploy(this.startTime, this.raiseDuration, this.internshipDuration, this.contractDuraction);
        await this.stages.deployed();
        [this.deployer] = await ethers.getSigners();
    });

    it('test stage none', async function() {
        expect(await this.stages.currentStage()).to.equal(0); // 0 for stage None
    })

    it('test stage raise', async function() {
        await network.provider.send('evm_setNextBlockTimestamp', [this.startTime.toNumber()])
        await this.deployer.sendTransaction({to: this.deployer.address, value: 0})
        expect(await this.stages.currentStage()).to.equal(1); // 1 for stage Raise
    })

    it('test stage internship', async function() {
        await network.provider.send('evm_setNextBlockTimestamp', [this.startTime.add(this.raiseDuration).toNumber()])
        await this.deployer.sendTransaction({to: this.deployer.address, value: 0})
        expect(await this.stages.currentStage()).to.equal(2); // 0 for stage Internship
    })

    it('test stage deliver', async function() {
        await network.provider.send('evm_setNextBlockTimestamp', [this.startTime.add(this.raiseDuration).add(this.internshipDuration).toNumber()])
        await this.deployer.sendTransaction({to: this.deployer.address, value: 0})
        expect(await this.stages.currentStage()).to.equal(3); // 3 for stage Deliver
    })

    it('test stage final', async function() {
        await network.provider.send('evm_setNextBlockTimestamp', [this.startTime.add(this.raiseDuration).add(this.contractDuraction).toNumber()])
        await this.deployer.sendTransaction({to: this.deployer.address, value: 0})
        expect(await this.stages.currentStage()).to.equal(4); // 0 for stage Final
    })

});
