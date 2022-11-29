// test/HashNFT.test.js
// Load dependencies
const { expect } = require('chai')
const { BigNumber } = require('ethers')

describe('HashNFT', function () {
  let deployer
  let root
  let notRoot
  let issuer
  let buyer
  let testAddr

  let usdt
  let wbtc
  let hashnft
  let oracle
  let riskControl

  const USDTDecimals = 18
  const basePrice = ethers.utils.parseUnits('100', USDTDecimals)
  const total = 10 * 1000
  const note = "mrc"
  let startTime

  beforeEach(async function () {
    [deployer, root, notRoot, issuer, buyer, testAddr] = await ethers.getSigners()
    const ERC20Contract = await ethers.getContractFactory("MyERC20")
    usdt = await ERC20Contract.deploy("USDT", "usdt", ethers.utils.parseUnits('100000000', USDTDecimals), USDTDecimals)
    await usdt.deployed()

    wbtc = await ERC20Contract.deploy("Wrapped Bitcoin", "wbtc", ethers.utils.parseUnits('100000000', 8), 8)
    await wbtc.deployed()

    const OracleContract = await ethers.getContractFactory("MockEarningsOracle")
    oracle = await OracleContract.deploy()

    const bestBlock = await ethers.provider.getBlock()
    startTime = (Math.floor(bestBlock.timestamp / 3600 / 24) + 1) * 3600 * 24
    const RiskContract = await ethers.getContractFactory("RiskControl")
    riskControl = await RiskContract.deploy(startTime, basePrice, usdt.address, issuer.address, oracle.address)

    const HashNFTContract = await ethers.getContractFactory('HashNFT')
    hashnft = await HashNFTContract.deploy(total, usdt.address, wbtc.address, issuer.address, riskControl.address, oracle.address)
  })

  describe('public member variables', function () {
    it('immutable', async function () {
      expect(await hashnft.total()).to.equal(total)
      expect(await hashnft.payment()).to.equal(usdt.address)
      expect(await hashnft.oracle()).to.equal(oracle.address)
      expect(await hashnft.riskControl()).to.equal(riskControl.address)

      // expect(await hashnft.basePrice()).to.equal(basePrice)
      // let expected = ethers.utils.parseUnits('5', USDTDecimals)
      // expect(await hashnft.tax()).to.equal(expected)
      // expect(await hashnft.optionFunds()).to.equal(expected)
    })
  })

  // describe('price ()', function () {
  //   it('success', async function () {
  //     let expected = ethers.utils.parseUnits('110', USDTDecimals)
  //     expect(await hashnft.price()).to.equal(expected)
  //   })
  // })

  describe('mint (address, uint256)', function () {
    it('revert not allowed', async function () {
      await expect(
        hashnft.functions['mint(address,uint8,string)'](testAddr.address, 1, note)
      ).to.be.revertedWith("HashNFT: risk not allowed to mint")
    })

    it('revert zero address', async function () {
      await network.provider.send('evm_setNextBlockTimestamp', [startTime])
      await expect(
        hashnft.functions['mint(address,uint8,string)'](ethers.constants.AddressZero, 1, note)
      ).to.be.revertedWith("HashNFT: mint to the zero address")
    })

    it('revert insufficient payment', async function () {
      await network.provider.send('evm_setNextBlockTimestamp', [startTime])
      await expect(
        hashnft.functions['mint(address,uint8,string)'](testAddr.address, 1, note)
      ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it('success', async function () {
      await network.provider.send('evm_setNextBlockTimestamp', [startTime])
      const hashType = 2
      const hashrate = await hashnft.hashRateOf(hashType)
      const tokenId = 0
      const amount = (await riskControl.price()).mul(hashrate)

      await usdt.transfer(buyer.address, amount)
      await usdt.connect(buyer).approve(hashnft.address, amount)
      await expect(
        hashnft.connect(buyer).functions['mint(address,uint8,string)'](buyer.address, hashType, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer.address, buyer.address, tokenId, hashrate, note)

      expect(await hashnft.sold()).to.equal(hashrate)
      expect(await hashnft.ownerOf(tokenId)).to.equal(buyer.address)
    })
  })

  describe('tokenURI (uint256)', function () {
    async function mintNFT() {
      await network.provider.send('evm_setNextBlockTimestamp', [startTime])
      const hashType = 2
      const hashrate = await hashnft.hashRateOf(hashType)
      const amount = (await riskControl.price()).mul(hashrate)

      await usdt.transfer(buyer.address, amount)
      await usdt.connect(buyer).approve(hashnft.address, amount)
      await hashnft.connect(buyer).functions['mint(address,uint8,string)'](buyer.address, hashType, note)
    }

    it('revert not exist', async function () {
      const tokenId = 0
      await expect(
        hashnft.tokenURI(tokenId)
      ).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token")
    })

    it('success', async function () {
      await mintNFT()
      const tokenId = 0
      const uri = "https://gateway.pinata.cloud/ipfs/QmeXA6bFsvAZspDvQTAiGZ7xdCyKPjKcFVzFRmaZQF7acb"
      expect(await hashnft.tokenURI(tokenId)).to.equal(uri)
    })
  })

  describe('setBaseURI', function () {
    async function mintNFT() {
      await network.provider.send('evm_setNextBlockTimestamp', [startTime])
      const hashType = 2
      const hashrate = await hashnft.hashRateOf(hashType)
      const amount = (await riskControl.price()).mul(hashrate)

      await usdt.transfer(buyer.address, amount)
      await usdt.connect(buyer).approve(hashnft.address, amount)
      await hashnft.connect(buyer).functions['mint(address,uint8,string)'](buyer.address, hashType, note)
    }

    it('revert not owner', async function () {
      const tokenId = 0
      const uri = "https://ipfs.io/ipfs/QmeXA6bFsvAZspDvQTAiGZ7xdCyKPjKcFVzFRmaZQF7acb"
      await expect(
        hashnft.connect(notRoot).setBaseURI(uri)
      ).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it('success', async function () {
      const tokenId = 0
      await mintNFT()
      const uri = "https://ipfs.io/ipfs/QmeXA6bFsvAZspDvQTAiGZ7xdCyKPjKcFVzFRmaZQF7acb/"
      await hashnft.setBaseURI(uri)
      expect(await hashnft.tokenURI(tokenId)).to.equal(`${uri}${tokenId}`)
    })
  })

  describe('liquidate', function () {
    it('revert liquidate while stage is not correct', async function () {
      await expect(hashnft.liquidate()).to.revertedWith('Stages: not the right stage')
    })

    it('success', async function() {
      const duration = await riskControl.collectionPeriodDuration()
      await network.provider.send('evm_setNextBlockTimestamp', [startTime + duration.toNumber()])
      await hashnft.liquidate()
    })
  })

  describe('setIssuer (address)', function () {
    it('revert sender not issuer', async function () {
      await expect(
        hashnft.setIssuer(testAddr.address)
      ).to.be.revertedWith("HashNFT: msg not from issuer")
    })

    it('success', async function () {
      await expect(
        hashnft.connect(issuer).setIssuer(testAddr.address)
      ).to.emit(hashnft, 'IssuerHasChanged')
        .withArgs(issuer.address, testAddr.address)
    })
  })

  describe('deliver ()', function () {
    it('revert not allowed', async function () {
      await expect(
        hashnft.connect(issuer).deliver()
      ).to.be.revertedWith("HashNFT: risk not allowed to deliver")
    })

    it('revert sender not issuer', async function () {
      let duration = await riskControl.collectionPeriodDuration()
      await network.provider.send('evm_setNextBlockTimestamp', [startTime + duration.toNumber()])
      await expect(
        hashnft.deliver()
      ).to.be.revertedWith("HashNFT: msg not from issuer")
    })
  })
})

