const { ethers } = require('hardhat')
const { expect } = require('chai')

const zero = 0

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder()
  return abi.encode(types, values)
}

describe('Timelock', () => {
  let root, notAdmin
  let blockTimestamp
  let timelock
  let delay = 24 * 60 * 60
  let newDelay = delay / 2
  let gracePeriod = 4 * 60 * 60
  let target
  let value = zero
  let signature = 'setDelay(uint256)'
  let data = encodeParameters(['uint256'], [newDelay.toFixed()])
  let revertData = encodeParameters(['uint256'], [59])
  let eta

  beforeEach(async () => {
    [root, notAdmin] = await ethers.getSigners()
    const TimelockContract = await ethers.getContractFactory("Timelock")
    timelock = await TimelockContract.deploy(root.address, delay)
    const bestBlock = await ethers.provider.getBlock()
    blockTimestamp = bestBlock.timestamp
    target = timelock.address
    eta = blockTimestamp + delay
  })

  describe('constructor', () => {
    it('sets address of admin', async () => {
      const configuredAdmin = await timelock.admin()
      expect(configuredAdmin).equal(root.address)
    })

    it('sets delay', async () => {
      let configuredDelay = await timelock.delay()
      expect(configuredDelay).equal(delay)
    })
  })

  describe('setDelay', () => {
    it('requires msg.sender to be Timelock', async () => {
      await expect(
        timelock.connect(root).setDelay(delay)
      ).to.be.revertedWith('Timelock::setDelay: Call must come from Timelock.')
    })
  })

  describe('queueTransaction', () => {
    it('requires admin to be msg.sender', async () => {
      await expect(
        timelock.connect(notAdmin).queueTransaction(target, value, signature, data, eta)
      ).to.be.revertedWith('Timelock::queueTransaction: Call must come from admin.')
    })

    it('requires eta to exceed delay', async () => {
      const etaLessThanDelay = blockTimestamp + delay - 1
      await expect(
        timelock.connect(root).queueTransaction(target, value, signature, data, etaLessThanDelay)
      ).to.be.revertedWith('Timelock::queueTransaction: Estimated execution block must satisfy delay.')
    })

    it('sets hash as true in queuedTransactions mapping', async () => {
      etaNew = eta + 100
      queuedTxHash = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          [target, value.toString(), signature, data, etaNew.toString()]
        )
      )
      const queueTransactionsHashValueBefore = await timelock.queuedTransactions(queuedTxHash)
      expect(queueTransactionsHashValueBefore).to.equal(false)

      await timelock.connect(root).queueTransaction(target, value, signature, data, etaNew)

      const queueTransactionsHashValueAfter = await timelock.queuedTransactions(queuedTxHash)
      expect(queueTransactionsHashValueAfter).to.equal(true)
    })

    it('should emit QueueTransaction event', async () => {
      etaNew = eta + 100
      queuedTxHash = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          [target, value.toString(), signature, data, etaNew.toString()]
        )
      )
      const result = await timelock.connect(root).queueTransaction(target, value, signature, data, etaNew)
      expect(result).to.emit(timelock, "QueueTransaction")
        .withArgs(queuedTxHash,
          target,
          value.toString(),
          signature,
          data,
          etaNew.toString(),
        )
    })
  })

  describe('cancelTransaction', () => {
    beforeEach(async () => {
      eta = eta + 100
      await timelock.connect(root).queueTransaction(target, value, signature, data, eta)
    })

    it('requires admin to be msg.sender', async () => {
      await expect(
        timelock.connect(notAdmin).cancelTransaction(target, value, signature, data, eta)
      ).to.be.revertedWith('Timelock::cancelTransaction: Call must come from admin.')
    })

    it('sets hash from true to false in queuedTransactions mapping', async () => {
      queuedTxHash = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          [target, value.toString(), signature, data, eta.toString()]
        )
      )
      const queueTransactionsHashValueBefore = await timelock.queuedTransactions(queuedTxHash)
      expect(queueTransactionsHashValueBefore).to.equal(true)

      await timelock.connect(root).cancelTransaction(target, value, signature, data, eta)
      const queueTransactionsHashValueAfter = await timelock.queuedTransactions(queuedTxHash)
      expect(queueTransactionsHashValueAfter).to.equal(false)
    })

    it('should emit CancelTransaction event', async () => {
      queuedTxHash = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          [target, value, signature, data, eta]
        )
      )

      const result = await timelock.connect(root).cancelTransaction(target, value, signature, data, eta)
      expect(result).to.emit(timelock, "CancelTransaction")
      .withArgs(
        queuedTxHash,
          target,
          value,
          signature,
          data,
          eta,
      )
    })
  })

  describe('queue and cancel empty', () => {
    it('can queue and cancel an empty signature and data', async () => {
      eta = eta + 100
      const txHash = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          [target, value.toString(), '', '0x', eta.toString()]
        )
      )
      expect(await timelock.queuedTransactions(txHash)).to.equal(false)
      await timelock.connect(root).queueTransaction(target, value, '', '0x', eta)
      expect(await timelock.queuedTransactions(txHash)).to.equal(true)
      await timelock.connect(root).cancelTransaction(target, value, '', '0x', eta)
      expect(await timelock.queuedTransactions(txHash)).to.equal(false)
    })
  })

  describe('executeTransaction (setDelay)', () => {
    beforeEach(async () => {
      eta = eta + 100
      queuedTxHash = ethers.utils.keccak256(
        encodeParameters(
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          [target, value.toString(), signature, data, eta.toString()]
        )
      )
      // Queue transaction that will succeed
      await timelock.connect(root).queueTransaction(target, value, signature, data, eta)

      // Queue transaction that will revert when executed
      await timelock.connect(root).queueTransaction(target, value, signature, revertData, eta)
    })

    it('requires admin to be msg.sender', async () => {
      await expect(
        timelock.connect(notAdmin).executeTransaction(target, value, signature, data, eta)
      ).to.be.revertedWith('Timelock::executeTransaction: Call must come from admin.')
    })

    it('requires transaction to be queued', async () => {
      const differentEta = eta +1
      await expect(
        timelock.connect(root).executeTransaction(target, value, signature, data, differentEta)
      ).to.be.revertedWith("Timelock::executeTransaction: Transaction hasn't been queued.")
    })

    it('requires timestamp to be greater than or equal to eta', async () => {
      await expect(
        timelock.connect(root).executeTransaction(target, value, signature, data, eta)
      ).to.be.revertedWith(
        "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
      )
    })

    it('requires timestamp to be less than eta plus gracePeriod', async () => {
      timePoint = eta + gracePeriod + 1
      await network.provider.send('evm_setNextBlockTimestamp', [timePoint])
      await expect(
        timelock.connect(root).executeTransaction(target, value, signature, data, eta)
      ).to.be.revertedWith('Timelock::executeTransaction: Transaction is stale.')
    })

    it('requires target.call transaction to succeed', async () => {
      await network.provider.send('evm_setNextBlockTimestamp', [eta])

      await expect(
        timelock.connect(root).executeTransaction(target, value, signature, revertData, eta)
      ).to.be.revertedWith('Timelock::executeTransaction: Transaction execution reverted.')
    })

    it('sets hash from true to false in queuedTransactions mapping, updates delay, and emits ExecuteTransaction event', async () => {
      const configuredDelayBefore = await timelock.delay()
      expect(configuredDelayBefore).to.equal(delay)

      // eta =  blockTimestamp + delay
      
      const queueTransactionsHashValueBefore = await timelock.queuedTransactions(queuedTxHash)
      expect(queueTransactionsHashValueBefore).to.equal(true)

      const newBlockTimestamp = eta + 1
      await network.provider.send('evm_setNextBlockTimestamp', [newBlockTimestamp])

      const result = await timelock.connect(root).executeTransaction(target, value, signature, data, eta)

      const queueTransactionsHashValueAfter = await timelock.queuedTransactions(queuedTxHash)
      expect(queueTransactionsHashValueAfter).to.equal(false)

      const configuredDelayAfter = await timelock.delay()
      expect(configuredDelayAfter).to.equal(newDelay)

      expect(result).to.emit(timelock, "ExecuteTransaction").withArgs(
        queuedTxHash,
        target,
        value.toString(),
        signature,
        data,
        eta.toString(),
      )

      expect(result).to.emit(timelock, 'NewDelay').withArgs(newDelay.toString())
    })
  })
})