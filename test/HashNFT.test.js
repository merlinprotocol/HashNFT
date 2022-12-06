// test/HashNFT.test.js
// Load dependencies
const { expect } = require('chai')
const { BigNumber } = require('ethers')
const { ethers } = require('hardhat')

describe('HashNFT', function () {
  let deployer
  let admin
  let notAdmin
  let issuer
  let buyer
  let test
  let vault

  let usdt
  let wbtc
  let hashnft
  let riskControl
  let prices

  const USDTDecimals = 18
  const WBTCDecimals = 8
  const taxPercent = 500
  const optionPercent = 500
  const cost = ethers.utils.parseUnits('18', USDTDecimals)
  const total = 3 * 1000
  const note = "mrc"
  let startTime

  async function gotoCollection() {
    let timepoint = startTime
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  async function gotoOutCollection() {
    let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber()
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  async function mintHashNFT(to, typ) {
    await gotoCollection()
    await hashnft.connect(buyer).payForMint(to, typ, note)
  }

  beforeEach(async function () {
    [deployer, admin, notAdmin, issuer, buyer, test, vault] = await ethers.getSigners()
    const ERC20Contract = await ethers.getContractFactory("MyERC20")
    usdt = await ERC20Contract.deploy("USDT", "usdt", ethers.utils.parseUnits('100000000', USDTDecimals), USDTDecimals)
    await usdt.deployed()

    wbtc = await ERC20Contract.deploy("Wrapped Bitcoin", "wbtc", ethers.utils.parseUnits('100000000', 8), 8)
    await wbtc.deployed()

    const MockOracleContract = await ethers.getContractFactory('MockOracle')
    const BTCPrice = ethers.utils.parseUnits('38500', WBTCDecimals)
    let mockOracle = await MockOracleContract.deploy(BTCPrice)
    await mockOracle.deployed()

    const mockEarningsOralceContract = await ethers.getContractFactory("MockEarningsOracle")
    let mockEarningsOralce = await mockEarningsOralceContract.deploy()
    await mockEarningsOralce.deployed()

    const bestBlock = await ethers.provider.getBlock()
    startTime = (Math.floor(bestBlock.timestamp / 3600 / 24) + 1) * 3600 * 24
    const RiskContract = await ethers.getContractFactory("RiskControl")
    riskControl = await RiskContract.connect(admin).deploy(startTime, cost, optionPercent, taxPercent, usdt.address, wbtc.address, issuer.address, mockOracle.address, mockEarningsOralce.address)
    await riskControl.deployed()

    prices = [
      BigNumber.from(10),
      ethers.utils.parseUnits('269', USDTDecimals),
      BigNumber.from(20),
      ethers.utils.parseUnits('499', USDTDecimals),
      BigNumber.from(40),
      ethers.utils.parseUnits('999', USDTDecimals)
    ]
    const HashNFTContract = await ethers.getContractFactory('HashNFT')
    hashnft = await HashNFTContract.connect(admin).deploy(total, wbtc.address, riskControl.address, prices, vault.address)
    await hashnft.deployed()

    await riskControl.connect(admin).setHashNFT(hashnft.address)

    let totalSupply = await usdt.totalSupply()
    await usdt.transfer(buyer.address, totalSupply)
    await usdt.connect(buyer).approve(hashnft.address, totalSupply)
  })

  describe('public member variables', function () {
    it('immutable', async function () {
      expect(await hashnft.riskControl()).to.equal(riskControl.address)
      expect(await hashnft.total()).to.equal(total)
      expect(await hashnft.vault()).to.equal(vault.address)

      expect(await hashnft.traitHashrates(0)).to.equal(prices[0])
      expect(await hashnft.traitPrices(0)).to.equal(prices[1])
      expect(await hashnft.traitHashrates(1)).to.equal(prices[2])
      expect(await hashnft.traitPrices(1)).to.equal(prices[3])
      expect(await hashnft.traitHashrates(2)).to.equal(prices[4])
      expect(await hashnft.traitPrices(2)).to.equal(prices[5])
    })
  })

  describe('dispatcher () address', function () {
    it('success', async function () {
      expect(await hashnft.dispatcher()).to.equal(await hashnft.mtoken())
    })
  })

  describe('hashRateOf (uint256) address', function () {
    it('revert tokenId not exist', async function () {
      await expect(
        hashnft.hashRateOf(0)
      ).to.be.revertedWith('HashNFT: tokenId not exist')
    })

    it('success', async function () {
      await mintHashNFT(test.address, 1)
      expect(await hashnft.hashRateOf(0)).to.be.equal(20)
    })
  })

  describe('tokenURI (uint256) string', function () {
    it('revert tokenId not exist', async function () {
      await expect(
        hashnft.tokenURI(0)
      ).to.be.revertedWith('ERC721URIStorage: URI query for nonexistent token')
    })

    it('success', async function () {
      await mintHashNFT(test.address, 1)
      expect(await hashnft.tokenURI(0)).to.be.equal("https://gateway.pinata.cloud/ipfs/QmeXA6bFsvAZspDvQTAiGZ7xdCyKPjKcFVzFRmaZQF7acb")
    })
  })

  describe('updateURI (uint256, string) string', function () {
    const uri = 'https://gateway.pinata.cloud/ipfs/QmYc58gMPveZjw66tKyJ47gmDWavvV7qN4PG2YneNUqHcM'
    it('revert insufficient permissions', async function () {
      await expect(
        hashnft.connect(notAdmin).updateURI(0, uri)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('revert tokenId not exist', async function () {
      await expect(
        hashnft.updateURI(0, uri)
      ).to.be.revertedWith('ERC721URIStorage: URI query for nonexistent token')
    })

    it('success', async function () {
      await mintHashNFT(test.address, 1)
      await hashnft.connect(admin).updateURI(0, uri)
      expect(await hashnft.tokenURI(0)).to.be.equal(uri)
    })

    it('revert already updated', async function () {
      await mintHashNFT(test.address, 1)
      await hashnft.connect(admin).updateURI(0, uri)
      await expect(
        hashnft.connect(admin).updateURI(0, uri)
      ).to.be.revertedWith('HashNFT: token URI already updated')
    })
  })

  describe('payForMint (address, uint256, string)', function () {
    const hashType = 1
    it('revert not allowed', async function () {
      await expect(
        hashnft.connect(buyer).payForMint(test.address, hashType, note)
      ).to.be.revertedWith("HashNFT: risk not allowed to mint")
    })

    it('revert not allowed 2', async function () {
      await gotoOutCollection()
      await expect(
        hashnft.connect(buyer).payForMint(test.address, hashType, note)
      ).to.be.revertedWith("HashNFT: risk not allowed to mint")
    })

    it('revert zero address', async function () {
      await gotoCollection()
      await expect(
        hashnft.connect(buyer).payForMint(ethers.constants.AddressZero, hashType, note)
      ).to.be.revertedWith("HashNFT: mint to the zero address")
    })

    it('success', async function () {
      await gotoCollection()
      const trait = 2
      const hashrate = await hashnft.traitHashrates(trait)
      const tokenId = 0
      const amount = await hashnft.traitPrices(trait)

      await expect(
        hashnft.connect(buyer).payForMint(buyer.address, trait, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer.address, buyer.address, tokenId, trait, note)

      expect(await hashnft.sold()).to.equal(hashrate)
      expect(await hashnft.ownerOf(tokenId)).to.equal(buyer.address)
      let costs = (await riskControl.price()).mul(hashrate)
      expect(await usdt.balanceOf(riskControl.address)).to.equal(costs)
      expect(await usdt.balanceOf(vault.address)).to.equal(amount.sub(costs))
    })
  })

  describe('sell all', function () {
    it('success', async function () {
      await gotoCollection()

      let tokenId = 0
      let total = await hashnft.total()
      let sold = await hashnft.sold()
      let amount = BigNumber.from(0)
      while (total.sub(sold).toNumber() >= 40) {
        let trait = Math.floor(Math.random() * 10) % 3
        await expect(
          hashnft.connect(buyer).payForMint(buyer.address, trait, note)
        ).to.emit(hashnft, 'HashNFTMint')
          .withArgs(buyer.address, buyer.address, tokenId, trait, note)
        tokenId += 1
        amount = amount.add(await hashnft.traitPrices(trait))
        sold = await hashnft.sold()
      }
      let costs = (await riskControl.price()).mul(sold)
      expect(await usdt.balanceOf(riskControl.address)).to.equal(costs)
      expect(await usdt.balanceOf(vault.address)).to.equal(amount.sub(costs))
    })
  })
})

