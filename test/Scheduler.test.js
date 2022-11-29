const { ethers } = require('hardhat')
const { expect } = require('chai')

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder()
  return abi.encode(types, values)
}

describe('Scheduler', () => {
  let admin, tracker, proposer, executor, notProposer, notExecutor
  let oracle
  let scheduler
  const period = 3600 * 24
  const delay = 3600 * 23
  let target
  const value = 0
  let data
  let signature = 'trackDailyEarnings(uint256[],uint256[])'

  const f2poolHashrate = 31340
  const f2poolDailyEarnings = 450
  const antPoolHashrate = 201630
  const antPoolDailyEarnings = 427

  beforeEach(async function () {
    [admin, tracker, proposer, executor, notProposer, notExecutor] = await ethers.getSigners()

    const OracleContract = await ethers.getContractFactory('BitcoinEarningsOracle')
    oracle = await OracleContract.deploy()

    const SchedulerContract = await ethers.getContractFactory('Scheduler')
    scheduler = await SchedulerContract.deploy([proposer.address], [executor.address], period, delay)

    await oracle.addTracker(scheduler.address)

    target = oracle.address
    data = encodeParameters(['uint256[]', 'uint256[]'], [[f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate]])
  })

  describe('constructor', () => {
    it('period and delay', async function () {
      expect(await scheduler.period()).to.be.equal(period)
      expect(await scheduler.delay()).to.be.equal(delay)
    })
  })

  describe('schedule (address, uint256, string, bytes, bytes32)', () => {
    it('require msg sender is proposer', async function () {
      let role = await scheduler.PROPOSER_ROLE()
      const revertMsg = `AccessControl: account ${notProposer.address.toLowerCase()} is missing role ${role}`
      await expect(
        scheduler.connect(notProposer).schedule(target, value, signature, data, ZERO_BYTES32)
      ).to.be.revertedWith(revertMsg)
    })

    it('require operation not exist', async function () {
      await scheduler.connect(proposer).schedule(target, value, signature, data, ZERO_BYTES32)
      await expect(
        scheduler.connect(proposer).schedule(target, value, signature, data, ZERO_BYTES32)
      ).to.be.revertedWith("Scheduler: operation already scheduled")
    })

    it('success', async function () {
      let id = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'bytes32'],
          [target, value.toString(), signature, data, ZERO_BYTES32]
        )
      )
      await expect(
        scheduler.connect(proposer).schedule(target, value, signature, data, ZERO_BYTES32)
      ).to.emit(scheduler, "CallScheduled").withArgs(id)
      expect(await scheduler.queuedOperations(id)).to.equal(true)
    })
  })

  describe('execute (address, uint256, string, bytes, bytes32)', () => {
    it('require msg sender is executor', async function () {
      let role = await scheduler.EXECUTOR_ROLE()
      const revertMsg = `AccessControl: account ${notExecutor.address.toLowerCase()} is missing role ${role}`
      await expect(
        scheduler.connect(notExecutor).execute(target, value, signature, data, ZERO_BYTES32)
      ).to.be.revertedWith(revertMsg)
    })

    it('require operation must exist', async function () {
      await expect(
        scheduler.connect(executor).execute(target, value, signature, data, ZERO_BYTES32)
      ).to.be.revertedWith("Scheduler: operation is not exist")
    })

    it('require valid period', async function () {
      await scheduler.connect(proposer).schedule(target, value, signature, data, ZERO_BYTES32)
      await expect(
        scheduler.connect(executor).execute(target, value, signature, data, ZERO_BYTES32)
      ).to.be.revertedWith("Scheduler: error period")
    })

    it('success', async function () {
      let id = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'bytes32'],
          [target, value.toString(), signature, data, ZERO_BYTES32]
        )
      )
      await scheduler.connect(proposer).schedule(target, value, signature, data, ZERO_BYTES32)
      let bestBlock = await ethers.provider.getBlock()
      let timePoint = Math.floor(bestBlock.timestamp / 3600 / 24) * (3600 * 24) + delay
      await network.provider.send('evm_setNextBlockTimestamp', [timePoint])
      await expect(
        scheduler.connect(executor).execute(target, value, signature, data, ZERO_BYTES32)
      ).to.emit(scheduler, "CallExecuted").withArgs(id)

      earning = f2poolDailyEarnings * f2poolHashrate / (f2poolHashrate + antPoolHashrate) + antPoolDailyEarnings * antPoolHashrate / (f2poolHashrate + antPoolHashrate)
      earning = Math.floor(earning)
      bestBlock = await ethers.provider.getBlock()
      day = Math.floor(bestBlock.timestamp / 3600 / 24)

      let result = await oracle.getRound(day)
      expect(result).to.equal(earning)
    })
  })
})