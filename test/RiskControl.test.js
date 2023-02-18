// test/RiskControl.test.js
// Load dependencies
const { expect } = require('chai')
const { BigNumber } = require('ethers')
const { network } = require('hardhat')

describe('RiskConotrol', function () {
  let deployer
  let admin
  let notAdmin
  let issuer
  let test

  let startTime
  let riskControl
  let mockOracle
  let mockEarningsOralce
  let usdt
  let wbtc
  const taxPercent = 500
  const optionPercent = 500

  const USDTDecimals = 18
  const WBTCDecimals = 8
  const cost = ethers.utils.parseUnits('18', USDTDecimals)
  let wbtcAmount
  let usdtAmount
  let buyer1, buyer2, buyer3

  async function gotoStartTime() {
    let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber()
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  async function gotoTimePoint(days) {
    let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + days * 3600 * 24
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  beforeEach(async function () {
    [deployer, admin, notAdmin, issuer, test, buyer1, buyer2, buyer3] = await ethers.getSigners()
    const ERC20Contract = await ethers.getContractFactory("MyERC20")
    usdt = await ERC20Contract.deploy("USDT", "usdt", ethers.utils.parseUnits('100000000', USDTDecimals), USDTDecimals)
    await usdt.deployed()

    wbtcAmount = ethers.utils.parseUnits('100000000', WBTCDecimals)
    wbtc = await ERC20Contract.deploy("Wrapped Bitcoin", "wbtc", wbtcAmount, WBTCDecimals)
    await wbtc.deployed()

    const MockOracleContract = await ethers.getContractFactory('MockOracle')
    const BTCPrice = ethers.utils.parseUnits('38500', WBTCDecimals)
    mockOracle = await MockOracleContract.deploy(BTCPrice)
    await mockOracle.deployed()

    const mockEarningsOralceContract = await ethers.getContractFactory("MockEarningsOracle")
    mockEarningsOralce = await mockEarningsOralceContract.deploy()
    await mockEarningsOralce.deployed()

    const mockHashNFTContract = await ethers.getContractFactory("MockHashNFT")
    mockHashNFT = await mockHashNFTContract.deploy()
    await mockHashNFT.deployed()

    const bestBlock = await ethers.provider.getBlock()
    startTime = (Math.floor(bestBlock.timestamp / 3600 / 24) + 1) * 3600 * 24
    const RiskContract = await ethers.getContractFactory("RiskControl")
    riskControl = await RiskContract.connect(admin).deploy(startTime, cost, optionPercent, taxPercent, usdt.address, wbtc.address, issuer.address, mockOracle.address, mockEarningsOralce.address)
    await riskControl.deployed()

    await wbtc.transfer(issuer.address, wbtcAmount)
    await wbtc.connect(issuer).approve(riskControl.address, wbtcAmount)

    usdtAmount = (await riskControl.price()).mul(await mockHashNFT.sold())
    await usdt.transfer(riskControl.address, usdtAmount)
  })

  describe('public member variables', function () {
    it('immutable', async function () {
      expect(await riskControl.cost()).to.equal(cost)
      expect(await riskControl.taxPercent()).to.equal(taxPercent)
      expect(await riskControl.optionPercent()).to.equal(optionPercent)
      expect(await riskControl.funds()).to.equal(usdt.address)
      expect(await riskControl.rewards()).to.equal(wbtc.address)
      expect(await riskControl.priceOracle()).to.equal(mockOracle.address)
      expect(await riskControl.earningsOracle()).to.equal(mockEarningsOralce.address)
      expect(await riskControl.defaultInitialPaymentRatio()).to.equal(3500)

      expect(await wbtc.balanceOf(issuer.address)).to.equal(wbtcAmount)
      expect(await wbtc.allowance(issuer.address, riskControl.address)).to.equal(wbtcAmount)
      expect(await usdt.balanceOf(riskControl.address)).to.equal(usdtAmount)
    })
  })

  describe('setIssuer (address)', function () {
    it('revert insufficient permissions', async function () {
      const role = await riskControl.ADMIN_ROLE()
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(notAdmin).setIssuer(deployer.address)
      ).to.be.revertedWith(revertMsg)
    })

    it('success', async function () {
      const old = await riskControl.issuer()
      const to = deployer.address
      await expect(
        riskControl.connect(admin).setIssuer(to)
      ).to.emit(riskControl, 'IssuerHasChanged').withArgs(old, to)
      expect(await riskControl.issuer()).to.equal(to)
      const role = await riskControl.ISSUER_ROLE()
      expect(await riskControl.hasRole(role, to)).to.equal(true)
    })
  })

  describe('setHashNFT (address)', function () {
    it('revert insufficient permissions', async function () {
      let price = ethers.utils.parseUnits('19.8', USDTDecimals)
      expect(await riskControl.price()).to.equal(price)

      const role = await riskControl.ADMIN_ROLE()
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(notAdmin).setHashNFT(mockHashNFT.address)
      ).to.be.revertedWith(revertMsg)
    })

    it('success', async function () {
      await expect(
        riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      ).to.emit(riskControl, 'SetUpHashNFT').withArgs(mockHashNFT.address)
      expect(await riskControl.hashnft()).to.equal(mockHashNFT.address)
    })

    it('revert already set hashnft', async function () {
      await expect(
        riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      ).to.emit(riskControl, 'SetUpHashNFT').withArgs(mockHashNFT.address)
      expect(await riskControl.hashnft()).to.equal(mockHashNFT.address)

      await expect(
        riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      ).to.be.revertedWith("RiskControl: already set hashnft")
    })
  })

  describe('mintAllowed () bool', function () {
    it('period not in the beginning', async function () {
      expect(await riskControl.mintAllowed()).to.equal(false)
    })

    it('success', async function () {
      let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber()
      await network.provider.send('evm_setNextBlockTimestamp', [timepoint - 1])
      await ethers.provider.send("evm_mine")
      expect(await riskControl.mintAllowed()).to.equal(true)
    })

    it('already finish', async function () {
      await gotoStartTime()
      expect(await riskControl.mintAllowed()).to.equal(false)
    })
  })

  describe('deliverAllowed () bool', function () {
    it('period not in the beginning', async function () {
      expect(await riskControl.deliverAllowed()).to.equal(false)
    })

    it('success', async function () {
      await gotoStartTime()
      expect(await riskControl.deliverAllowed()).to.equal(true)
    })
  })

  describe('offset () uint256', function () {
    it('revert error stage', async function () {
      await expect(
        riskControl.offset()
      ).to.be.revertedWith("RiskControl: error stage")
    })

    it('success', async function () {
      await gotoStartTime()
      expect(await riskControl.offset()).to.equal(0)
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
      await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + (await riskControl.observationPeriodDuration()).toNumber()
      await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
      const gh = 0.4 * 10000
      const rb = 0.005 * 10000
      const pc = 0.05 * 10000
      const hg = 190
      const BTCPrice = ethers.utils.parseUnits('32500', 8)
      mockOracle.setPrice(BTCPrice)

      const ratio = 4900
      let deliverReleaseAmount = (await riskControl.cost()).mul(await mockHashNFT.sold()).mul(10000 - ratio).div(10000).div(331)
      await expect(
        riskControl.connect(admin).generateInitialPayment(gh, rb, hg, pc)
      ).to.emit(riskControl, 'InitialPaymentHasGenerated')
        .withArgs(ratio, deliverReleaseAmount)
      let initialPayment = BigNumber.from(cost).mul(await mockHashNFT.sold()).mul(ratio).div(10000)

      expect(await riskControl.initialPayment()).to.equal(initialPayment)
    })
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
        await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
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

  describe('claimInitialPayment ()', function () {
    it('revert insufficient permissions', async function () {
      const role = await riskControl.ISSUER_ROLE()
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(notAdmin).claimInitialPayment()
      ).to.be.revertedWith(revertMsg)
    })

    it('revert invalid initialPayment', async function () {
      await expect(
        riskControl.connect(issuer).claimInitialPayment()
      ).to.be.revertedWith('RiskControl: invalid initialPayment')
    })

    it('success', async function () {
      await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + (await riskControl.observationPeriodDuration()).toNumber()
      await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
      const gh = 0.4 * 10000
      const rb = 0.005 * 10000
      const pc = 0.05 * 10000
      const hg = 190
      const BTCPrice = ethers.utils.parseUnits('32500', 8)
      mockOracle.setPrice(BTCPrice)
      await riskControl.connect(admin).generateInitialPayment(gh, rb, hg, pc)
      const ratio = 4900
      let initialPayment = BigNumber.from(cost).mul(await mockHashNFT.sold()).mul(ratio).div(10000)
      expect(await riskControl.initialPayment()).to.equal(initialPayment)

      await expect(
        riskControl.connect(issuer).claimInitialPayment()
      ).to.emit(riskControl, 'ClaimInitialPayment')
        .withArgs(issuer.address, initialPayment)
      expect(await usdt.balanceOf(issuer.address)).to.equal(initialPayment)
    })
  })

  describe('deliver ()', function () {
    it('revert deliver not allowed', async function () {
      await expect(
        riskControl.deliver()
      ).to.be.revertedWith("RiskControl: deliver not allowed")
    })

    it('revert already deliver', async function () {
      let day = 1
      await gotoTimePoint(day)
      await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      const bestBlock = await ethers.provider.getBlock()
      const today = Math.floor(bestBlock.timestamp / 3600 / 24)
      let earnings = await mockEarningsOralce.getRound(today - 1)
      let amount = earnings.mul((await mockHashNFT.sold()))
      await expect(
        riskControl.deliver()
      ).to.emit(riskControl, 'Deliver').withArgs(issuer.address, mockHashNFT.address, amount)
      expect(await riskControl.deliverRecords(day - 1)).to.equal(amount)
      await expect(
        riskControl.deliver()
      ).to.be.revertedWith("RiskControl: already deliver")
    })

    it('revert must generate initial payment', async function () {
      await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      for (let day = 1; day <= 29; day++) {
        await gotoTimePoint(day)
        let earnings = await mockEarningsOralce.getRound(day - 1)
        let amount = earnings * (await mockHashNFT.sold())
        await expect(
          riskControl.deliver()
        ).to.emit(riskControl, 'Deliver').withArgs(issuer.address, mockHashNFT.address, amount)
      }
      let day = 30
      await gotoTimePoint(day)
      await expect(
        riskControl.deliver()
      ).to.be.revertedWith('RiskControl: must generate initial payment')
    })
  })

  describe('deliverAllPeriod ()', function () {
    it('success', async function () {
      await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      let total = BigNumber.from(0)
      for (let day = 1; day <= 360; day++) {
        console.log(` deliver #${String(day)}`)
        await gotoTimePoint(day)
        if (day == 30) {
          const gh = 0.4 * 10000
          const rb = 0.005 * 10000
          const pc = 0.05 * 10000
          const hg = 190
          const BTCPrice = ethers.utils.parseUnits('32500', 8)
          mockOracle.setPrice(BTCPrice)
          await riskControl.connect(admin).generateInitialPayment(gh, rb, hg, pc)
          await riskControl.connect(issuer).claimInitialPayment()
        }
        const bestBlock = await ethers.provider.getBlock()
        const today = Math.floor(bestBlock.timestamp / 3600 / 24)
        let earnings = await mockEarningsOralce.getRound(today - 1)
        let amount = earnings * (await mockHashNFT.sold())
        await expect(
          riskControl.deliver()
        ).to.emit(riskControl, 'Deliver').withArgs(issuer.address, mockHashNFT.address, amount)
        total = total.add(amount) 
      }
      expect(await wbtc.balanceOf(mockHashNFT.address)).to.be.equal(total)
      let balance = (await riskControl.cost()).mul(await mockHashNFT.sold())
      expect(balance.sub(await usdt.balanceOf(issuer.address)).toNumber()).to.below(10)
    })
  })

  describe('claimTax (address)', function () {
    it('revert insufficient permissions', async function () {
      const role = await riskControl.ADMIN_ROLE()
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(notAdmin).claimTax(test.address)
      ).to.be.revertedWith(revertMsg)
    })

    it('revert not the right stage', async function () {
      await expect(
        riskControl.connect(admin).claimTax(test.address)
      ).to.be.revertedWith('Stages: not the right stage')
    })

    it('success', async function () {
      await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      await gotoTimePoint(30)
      let amount = (await riskControl.cost()).mul(await mockHashNFT.sold()).mul(await riskControl.taxPercent()).div(10000)
      await expect(
        riskControl.connect(admin).claimTax(test.address)
      ).to.emit(riskControl, 'ClaimTax').withArgs(test.address, amount)
      expect(await usdt.balanceOf(test.address)).to.be.equal(amount)
    })
  })

  describe('claimOption (address)', function () {
    it('revert insufficient permissions', async function () {
      const role = await riskControl.ADMIN_ROLE()
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(notAdmin).claimOption(test.address)
      ).to.be.revertedWith(revertMsg)
    })

    it('revert not the right stage', async function () {
      await expect(
        riskControl.connect(admin).claimOption(test.address)
      ).to.be.revertedWith('Stages: not the right stage')
    })

    it('success', async function () {
      await riskControl.connect(admin).setHashNFT(mockHashNFT.address)
      await gotoTimePoint(1)
      let amount = (await riskControl.cost()).mul(await mockHashNFT.sold()).mul(await riskControl.optionPercent()).div(10000)
      await expect(
        riskControl.connect(admin).claimOption(test.address)
      ).to.emit(riskControl, 'ClaimOption').withArgs(test.address, amount)
      expect(await usdt.balanceOf(test.address)).to.be.equal(amount)
    })
  })
})
