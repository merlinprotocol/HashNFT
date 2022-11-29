// test/BitcoinEarningsOracle.test.js
// Load dependencies
const { expect } = require('chai')
const { BigNumber } = require('ethers')

describe('BitcoinEarningsOracle', function () {
  let admin, tracker, notAdmin
  let oracle
  let day

  const f2poolHashrate = 31340
  const f2poolDailyEarnings = 450
  const antPoolHashrate = 201630
  const antPoolDailyEarnings = 427
  let earning

  beforeEach(async function () {
    [admin, tracker, notAdmin] = await ethers.getSigners()
    const OracleContract = await ethers.getContractFactory('BitcoinEarningsOracle')
    oracle = await OracleContract.deploy()

    const bestBlock = await ethers.provider.getBlock()
    day = Math.floor(bestBlock.timestamp / 3600 / 24)

    earning = f2poolDailyEarnings * f2poolHashrate / (f2poolHashrate + antPoolHashrate) + antPoolDailyEarnings * antPoolHashrate / (f2poolHashrate + antPoolHashrate)
    earning = Math.floor(earning)
  })

  describe('addTracker (address)', function () {
    it('insufficient permissions', async function () {
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      await expect(
        oracle.connect(notAdmin).addTracker(tracker.address)
      ).to.be.revertedWith(revertMsg)
    })

    it('success', async function () {
      let role = await oracle.TRACK_ROLE()

      await expect(oracle.connect(admin).addTracker(tracker.address))
        .to.emit(oracle, 'RoleGranted')
        .withArgs(role, tracker.address, admin.address)
    })
  })

  describe('trackDailyEarnings (uint256[], uint256[])', function () {
    it('success', async function () {
      await oracle.connect(admin).addTracker(tracker.address)
      await expect(
        oracle.connect(tracker).trackDailyEarnings([f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate])
      ).to.emit(oracle, 'TrackDailyEarnings')
        .withArgs(day, earning)
    })
  })

  describe('lastRound ()', function () {
    it('success', async function () {
      await oracle.connect(admin).addTracker(tracker.address)
      await oracle.connect(tracker).trackDailyEarnings([f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate])
      const bestBlock = await ethers.provider.getBlock()
      let day = Math.floor(bestBlock.timestamp / 3600 / 24)
      let result = await oracle.lastRound()
      expect(result[0]).to.be.equal(BigNumber.from(day))
      expect(result[1]).to.be.equal(BigNumber.from(earning))
    })
  })
  
  describe('complementDailyEarnings (uint256, uint256[], uint256[])', function () {
    it('requires complement not today', async function () {
      await expect(
        oracle.connect(admin).complementDailyEarnings(day, [f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate])
      ).to.be.revertedWith("BitcoinYeildOracle: can't to complement on today")
    })

    it('requires earning is missing', async function () {
      await oracle.connect(admin).addTracker(tracker.address)
      await oracle.connect(tracker).trackDailyEarnings([f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate])
      const bestBlock = await ethers.provider.getBlock()
      timePoint = bestBlock.timestamp + 24 * 3600
      await network.provider.send('evm_setNextBlockTimestamp', [timePoint])
      await expect(
        oracle.connect(admin).complementDailyEarnings(day, [f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate])
      ).to.be.revertedWith("BitcoinYeildOracle: complement only missing earning")
    })
    
    it('success', async function () {
      const bestBlock = await ethers.provider.getBlock()
      timePoint = bestBlock.timestamp + 24 * 3600
      await network.provider.send('evm_setNextBlockTimestamp', [timePoint])
      await expect(
        oracle.connect(admin).complementDailyEarnings(day, [f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate])
      ).to.emit(oracle, 'ComplementDailyEarnings')
        .withArgs(day, earning)
    })
  })
})  