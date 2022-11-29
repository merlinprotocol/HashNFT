// test/RiskControl.test.js
// Load dependencies
const { expect } = require('chai')
const { BigNumber } = require('ethers')

describe('RiskConotrol', function () {
  let deployer
  let admin
  let notAdmin
  let issuer

  let startTime
  let riskControl
  let mockOracles

  const USDTDecimals = 18
  const basePrice = ethers.utils.parseUnits('100', USDTDecimals)

  beforeEach(async function () {
    [deployer, notAdmin, issuer, buyer, testAddr] = await ethers.getSigners()
    admin = deployer
    const ERC20Contract = await ethers.getContractFactory("MyERC20")
    usdt = await ERC20Contract.deploy("USDT", "usdt", ethers.utils.parseUnits('100000000', USDTDecimals), USDTDecimals)
    await usdt.deployed()

    const MockOracleContract = await ethers.getContractFactory('MockOracle')
    const BTCPrice = ethers.utils.parseUnits('38500', 8)
    mockOracle = await MockOracleContract.deploy(BTCPrice)
    await mockOracle.deployed()

    const bestBlock = await ethers.provider.getBlock()
    startTime = (Math.floor(bestBlock.timestamp / 3600 / 24) + 1) * 3600 * 24
    const RiskContract = await ethers.getContractFactory("RiskControl")
    riskControl = await RiskContract.deploy(startTime, basePrice, usdt.address, issuer.address, mockOracle.address)
  })

  describe('public member variables', function () {
    it('immutable', async function () {
      expect(await riskControl.basePrice()).to.equal(basePrice)
      expect(await riskControl.funds()).to.equal(usdt.address)

      expect(await riskControl.defaultInitialPaymentRatio()).to.equal(3500)
    })
  })

  describe('price () uint256', function () {
    it('success', async function () {
      let price = ethers.utils.parseUnits('110', USDTDecimals)
      expect(await riskControl.price()).to.equal(price)
    })
  })

  describe('increaseFunds (uint256)', function () {
    async function prepare(hashrate) {
      const amount = (await riskControl.price()).mul(hashrate)
      await usdt.transfer(issuer.address, amount)
      await usdt.connect(issuer).approve(riskControl.address, amount)
      return amount
    }

    it('revert error role', async function () {
      const hashrate = 100
      let amount = await prepare(hashrate)
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122`
      await expect(
        riskControl.connect(notAdmin).increaseFunds(amount)
      ).to.be.revertedWith(revertMsg)
    })

    it('success', async function () {
      const hashrate = 100
      let amount = await prepare(hashrate)
      await expect(
        riskControl.connect(issuer).increaseFunds(amount)
      ).to.emit(riskControl, 'FundsHasIncreased')
        .withArgs(amount)
      const taxBalance = ethers.utils.parseUnits('500', USDTDecimals)
      expect(await riskControl.tax()).to.equal(taxBalance)
      const optionBalance = ethers.utils.parseUnits('500', USDTDecimals)
      expect(await riskControl.option()).to.equal(optionBalance)
    })
  })

  describe('generateInitialPayment(uint256, uint256, uint256, uint256)', function () {
    it('revert error stage', async function () {
      await expect(
        riskControl.generateInitialPayment(0, 0, 0, 0)
      ).to.be.revertedWith("Stages: not the right stage")
    })

    it('revert error role', async function () {
      let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + (await riskControl.observationPeriodDuration()).toNumber()
      await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775`
      await expect(
        riskControl.connect(notAdmin).generateInitialPayment(100, 100, 100, 100)
      ).to.be.revertedWith(revertMsg)
    })

    it('success', async function () {
      let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + (await riskControl.observationPeriodDuration()).toNumber()
      await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
      const gh = 0.4 * 10000
      const rb = 0.005 * 10000
      const pc = 0.05 * 10000
      const hg = 190
      const BTCPrice = ethers.utils.parseUnits('32500', 8)
      mockOracle.setPrice(BTCPrice)

      const amount = (await riskControl.price()).mul(100)
      await usdt.transfer(issuer.address, amount)
      await usdt.connect(issuer).approve(riskControl.address, amount)
      await riskControl.connect(issuer).increaseFunds(amount)
      const ratio = 4900
      await expect(
        riskControl.connect(admin).generateInitialPayment(gh, rb, hg, pc)
      ).to.emit(riskControl, 'InitialPaymentHasGenerated')
        .withArgs(ratio)
      let balance = await riskControl.balance()
      expect(await riskControl.initialPayment()).to.equal(balance.mul(ratio).div(10000))
    })

    describe('generateInitialPayment batch', function () {
      const hgs = [190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250]
      const BTCPrices = ['32500', '33500', '34500', '35500', '36500', '37500', '38500', '39500', '40500', '41500', '42500', '43500', '44500', '45500']
      const expecteds = [
        36.05, 37.23, 38.34, 39.40, 40.41, 41.37, 42.29, 43.16, 44.00, 44.81, 45.58, 46.32, 47.02,
        34.65, 35.86, 37.00, 38.10, 39.14, 40.13, 41.07, 41.98, 42.84, 43.67, 44.46, 45.22, 45.96,
        33.24, 34.49, 35.67, 36.79, 37.86, 38.88, 39.86, 40.79, 41.68, 42.53, 43.35, 44.13, 44.89,
        31.84, 33.12, 34.33, 35.49, 36.59, 37.64, 38.64, 39.60, 40.52, 41.40, 42.24, 43.04, 43.82,
        30.43, 31.75, 33.00, 34.19, 35.32, 36.40, 37.43, 38.41, 39.36, 40.26, 41.12, 41.95, 42.75,
        29.02, 30.38, 31.66, 32.88, 34.05, 35.16, 36.21, 37.23, 38.19, 39.12, 40.01, 40.86, 41.68,
        27.62, 29.00, 30.32, 31.58, 32.77, 33.91, 35.00, 36.04, 37.03, 37.98, 38.90, 39.77, 40.61,
        26.21, 27.63, 28.99, 30.27, 31.50, 32.67, 33.79, 34.85, 35.87, 36.85, 37.78, 38.68, 39.54,
        24.80, 26.26, 27.65, 28.97, 30.23, 31.43, 32.57, 33.66, 34.71, 35.71, 36.67, 37.59, 38.47,
        23.40, 24.89, 26.32, 27.67, 28.96, 30.18, 31.36, 32.48, 33.55, 34.57, 35.56, 36.50, 37.40,
        21.99, 23.52, 24.98, 26.36, 27.68, 28.94, 30.14, 31.29, 32.39, 33.44, 34.44, 35.41, 36.34,
        20.58, 22.15, 23.64, 25.06, 26.41, 27.70, 28.93, 30.10, 31.22, 32.30, 33.33, 34.32, 35.27,
        20.00, 20.78, 22.31, 23.76, 25.14, 26.46, 27.71, 28.91, 30.06, 31.16, 32.22, 33.23, 34.20,
        20.00, 20.00, 20.97, 22.45, 23.87, 25.21, 26.50, 27.73, 28.90, 30.03, 31.10, 32.14, 33.13
      ]
      const price = ethers.utils.parseUnits('48.04', 8)

      for (var i = 0; i < expecteds.length; i++) {
        const desRatio = ethers.utils.parseUnits(expecteds[i].toString(), 2);
        const cBTCPrice = ethers.utils.parseUnits(BTCPrices[Math.floor(i / hgs.length)], 8);

        it(`batch #${String(i)}`, async function () {
          let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + (await riskControl.observationPeriodDuration()).toNumber()
          await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
          mockOracle.setPrice(cBTCPrice)
          const gh = 0.4 * 10000
          const rb = 0.005 * 10000
          const pc = 0.05 * 10000
          const tx = await riskControl.connect(admin).generateInitialPayment(gh, rb, hgs[i % hgs.length] * 1e6, pc)
          const receipt = await tx.wait();
          const evt = receipt.events[receipt.events.length - 1];
          const ratio = evt.args.ratio;
          expect(desRatio.toNumber() - ratio.toNumber()).to.below(30)
        })
      }
    })
  })
})