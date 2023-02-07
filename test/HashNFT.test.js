// test/HashNFT.test.js
// Load dependencies
const { expect } = require('chai')
const { BigNumber } = require('ethers')
const { ethers } = require('hardhat')
const { MerkleTree } = require("merkletreejs")

describe('HashNFT', function () {
  let deployer
  let admin
  let notAdmin
  let issuer
  let buyer, buyer2, buyer3
  let whiteListBuyer
  const whiteListLimit = 2
  let nodeBuyer
  const nodeLimit = 5
  let test
  let vault
  let whiteListMerkleTree
  let nodeMerkleTree

  let usdt
  let wbtc
  let hashnft
  let riskControl
  let prices

  const USDTDecimals = 18
  const WBTCDecimals = 8
  const taxPercent = 500
  const optionPercent = 500
  let whiteListEndTime
  const cost = ethers.utils.parseUnits('18', USDTDecimals)
  const note = "mrc"
  let startTime

  async function gotoWhiteListCollection() {
    let timepoint = startTime
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  async function gotoPublicCollection() {
    let timepoint = whiteListEndTime
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  async function gotoOutCollection() {
    let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber()
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  async function gotoTimePoint(days) {
    let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + days * 3600 * 24
    await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
    await ethers.provider.send("evm_mine")
  }

  async function mintHashNFT(wallet, typ) {
    await gotoPublicCollection()
    let hashedAddress = ethers.utils.keccak256(wallet.address)
    let proof = whiteListMerkleTree.getHexProof(hashedAddress)
    await hashnft.connect(wallet).payForMint(proof, typ, note)
  }

  async function generateWhiteListRootHash(whiteListBuyer) {
    let addresses = [
      "0x1406aF0f2e7C80A04962A85FaE8bB17F89c2B606", "0x8f8BBaef28Ce761491739E098ebd5823c331b0f7", "0x73c8495deD92858bD369f6732dA15ad07E060592",
      "0xaa6De3f0F61Ee38dddA17A318f670BE624506ACe", "0x5e3Ad07C1605c4CC2d1f9503391D8d54502FDA75", "0xc4C806F427Bfb3936a491dF6a60567Eb533aE89A",
      "0xd27E703483163e003E0A2DdEB29E7ea9b698923F", "0x6e3B13756fF7E85453f14E020887575F9814C38b", "0x837AE41134fC1ad23e278762Ac2Fac0Fb507567b",
      "0xb6ac65b5abfc737DB4Dc2c3e90b086FFEB700745", "0xc82e4F40f25e6Db4087c9b9a411DF8Ca5a96cDa9", "0xD4Be51af00044F273efE6616E6389338254b13a3",
    ]
    addresses.push(whiteListBuyer.address)
    let leaves = addresses.map(addr => ethers.utils.keccak256(addr))
    whiteListMerkleTree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true })
    return whiteListMerkleTree.getRoot()
  }

  async function generateNodeRootHash(nodeBuyer) {
    let addresses = [
      "0xeE2dac56D96F44Adf0515a8d3c88f4B64FC7321e", "0x2568D8FA520a0887D114CA9c99b8d205Cf61dBf6", "0x328b4fd30C4FaaDa2Ae10C750c75C5f04D2C8293", 
      "0xBE830B967C6a13675cb24b35401564190b882D0E", "0xB1fcF46116022E401704Ad901bB52b486272f869", "0x1EE9ea5F314DedE44455650Ee56dAa42f1091A32", 
      "0x8F05C04370aE2C7765A60390d21Bb10DF7603285", "0x74060EA11b7d820Dd54e8356bA8969b33F33B121", "0x29BEDc56E1CbF3ebbF8763C31f1814fF36a58ed4", 
      "0x89b36C6058ec97496419BeAEC862d5B243b34c80", "0x3060A94E27b6f7A1Abe0dE2CbC90FFEc0b8D51a3", "0x425ce127A38Fb8D3De973d8aF8a5DCb4044adde1", 
    ]
    addresses.push(nodeBuyer.address)
    let leaves = addresses.map(addr => ethers.utils.keccak256(addr))
    nodeMerkleTree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true })
    return nodeMerkleTree.getRoot()
  }

  beforeEach(async function () {
    [deployer, admin, notAdmin, issuer, buyer, buyer2, buyer3, whiteListBuyer, nodeBuyer, test, vault] = await ethers.getSigners()
    const ERC20Contract = await ethers.getContractFactory("MyERC20")
    usdt = await ERC20Contract.deploy("USDT", "usdt", ethers.utils.parseUnits('3000000000', USDTDecimals), USDTDecimals)
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
      BigNumber.from(10), ethers.utils.parseUnits('269', USDTDecimals), BigNumber.from(200),
      BigNumber.from(20), ethers.utils.parseUnits('499', USDTDecimals), BigNumber.from(100),
      BigNumber.from(40), ethers.utils.parseUnits('999', USDTDecimals), BigNumber.from(25)
    ]
    const whiteListRootHash = await generateWhiteListRootHash(whiteListBuyer)
    const nodeRootHash = await generateNodeRootHash(nodeBuyer)
    whiteListEndTime = startTime + 3600 * 24 * 2
    const HashNFTContract = await ethers.getContractFactory('HashNFT')
    hashnft = await HashNFTContract.connect(admin).deploy(wbtc.address, riskControl.address, prices, vault.address, whiteListEndTime, whiteListRootHash, whiteListLimit, nodeRootHash, nodeLimit)
    await hashnft.deployed()

    await riskControl.connect(admin).setHashNFT(hashnft.address)

    let amount = await usdt.totalSupply()
    amount = amount.div(5)
    await usdt.transfer(buyer.address, amount)
    await usdt.connect(buyer).approve(hashnft.address, amount)

    await usdt.transfer(buyer2.address, amount)
    await usdt.connect(buyer2).approve(hashnft.address, amount)

    await usdt.transfer(buyer3.address, amount)
    await usdt.connect(buyer3).approve(hashnft.address, amount)

    await usdt.transfer(whiteListBuyer.address, amount)
    await usdt.connect(whiteListBuyer).approve(hashnft.address, amount)

    await usdt.transfer(nodeBuyer.address, amount)
    await usdt.connect(nodeBuyer).approve(hashnft.address, amount)
  })

  describe('public member variables', function () {
    it('immutable', async function () {
      expect(await hashnft.riskControl()).to.equal(riskControl.address)
      expect(await hashnft.totalSupply()).to.equal(5000)
      expect(await hashnft.vault()).to.equal(vault.address)

      expect(await hashnft.traitHashrates(0)).to.equal(prices[0])
      expect(await hashnft.traitPrices(0)).to.equal(prices[1])
      expect(await hashnft.traitBalance(0)).to.equal(prices[2])
      expect(await hashnft.traitHashrates(1)).to.equal(prices[3])
      expect(await hashnft.traitPrices(1)).to.equal(prices[4])
      expect(await hashnft.traitBalance(1)).to.equal(prices[5])
      expect(await hashnft.traitHashrates(2)).to.equal(prices[6])
      expect(await hashnft.traitPrices(2)).to.equal(prices[7])
      expect(await hashnft.traitBalance(2)).to.equal(prices[8])

      expect(await hashnft.whiteListEndtime()).to.equal(whiteListEndTime)

      const mTokenContract = await ethers.getContractFactory('mToken')
      let mtoken = mTokenContract.attach(await hashnft.mtoken())
      expect(await mtoken.owner()).to.be.equal(hashnft.address)
      await expect(
        mtoken.connect(deployer).addPayee(0, 100)
      ).to.be.revertedWith('Ownable: caller is not the owner')
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
      await mintHashNFT(buyer, 1)
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
      await mintHashNFT(buyer, 1)
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
      await mintHashNFT(buyer, 1)
      await hashnft.connect(admin).updateURI(0, uri)
      expect(await hashnft.tokenURI(0)).to.be.equal(uri)
    })

    it('revert already updated', async function () {
      await mintHashNFT(buyer, 1)
      await hashnft.connect(admin).updateURI(0, uri)
      await expect(
        hashnft.connect(admin).updateURI(0, uri)
      ).to.be.revertedWith('HashNFT: token URI already updated')
    })
  })

  describe('payForMint (bytes32[], uint256, string)', function () {
    const hashType = 1
    it('revert not allowed', async function () {
      let hashedAddress = ethers.utils.keccak256(test.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      await expect(
        hashnft.connect(buyer).payForMint(proof, hashType, note)
      ).to.be.revertedWith("HashNFT: risk not allowed to mint")
    })

    it('revert not allowed 2', async function () {
      await gotoOutCollection()
      let hashedAddress = ethers.utils.keccak256(test.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      await expect(
        hashnft.connect(buyer).payForMint(proof, hashType, note)
      ).to.be.revertedWith("HashNFT: risk not allowed to mint")
    })

    it('revert not in whitelist', async function () {
      await gotoWhiteListCollection()
      let hashedAddress = ethers.utils.keccak256(buyer.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      await expect(
        hashnft.connect(buyer).payForMint(proof, hashType, note)
      ).to.be.revertedWith("HashNFT: not in whitelist")
    })

    it('revert insufficient whitelist', async function () {
      await gotoWhiteListCollection()
      const limit = await hashnft.whiteListMintLimit()
      let hashedAddress = ethers.utils.keccak256(whiteListBuyer.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      const hashType = 2
      const note = "merlin"
      for (let idx = 0; idx < limit; idx ++) {
        await hashnft.connect(whiteListBuyer).payForMint(proof, hashType, note)
        expect(await hashnft.whiteListMint(whiteListBuyer.address)).to.be.equal(idx+1)
      }
      await expect(
        hashnft.connect(whiteListBuyer).payForMint(proof, hashType, note)
      ).to.be.revertedWith("HashNFT: insufficient whitelist")
    })

    it('revert insufficient whitelist of node', async function () {
      await gotoWhiteListCollection()
      const limit = await hashnft.nodeMintLimit()
      let hashedAddress = ethers.utils.keccak256(nodeBuyer.address)
      let proof = nodeMerkleTree.getHexProof(hashedAddress)
      const hashType = 2
      const note = "merlin"
      for (let idx = 0; idx < limit; idx ++) {
        await hashnft.connect(nodeBuyer).payForMint(proof, hashType, note)
        expect(await hashnft.nodeMint(nodeBuyer.address)).to.be.equal(idx+1)
      }
      await expect(
        hashnft.connect(nodeBuyer).payForMint(proof, hashType, note)
      ).to.be.revertedWith("HashNFT: insufficient whitelist of node")
    })

    it('success mint with whitelist', async function () {
      await gotoWhiteListCollection()
      let hashedAddress = ethers.utils.keccak256(whiteListBuyer.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      const tokenId = 0
      const trait = 1
      const note = "merlin"
      await expect(
        hashnft.connect(whiteListBuyer).payForMint(proof, hashType, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(whiteListBuyer.address, tokenId, trait, note)
    })

    it('success mint with whitelist in public mint', async function () {
      await gotoPublicCollection()
      let hashedAddress = ethers.utils.keccak256(whiteListBuyer.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      const tokenId = 0
      const trait = 1
      const note = "merlin"
      await expect(
        hashnft.connect(whiteListBuyer).payForMint(proof, hashType, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(whiteListBuyer.address, tokenId, trait, note)
    })

    it('success mint with whitelist of node', async function () {
      await gotoWhiteListCollection()
      let hashedAddress = ethers.utils.keccak256(nodeBuyer.address)
      let proof = nodeMerkleTree.getHexProof(hashedAddress)
      const tokenId = 0
      const trait = 1
      const note = "merlin"
      await expect(
        hashnft.connect(nodeBuyer).payForMint(proof, hashType, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(nodeBuyer.address, tokenId, trait, note)
    })

    it('success mint with whitelist of node in public mint', async function () {
      await gotoPublicCollection()
      let hashedAddress = ethers.utils.keccak256(nodeBuyer.address)
      let proof = nodeMerkleTree.getHexProof(hashedAddress)
      const tokenId = 0
      const trait = 1
      const note = "merlin"
      await expect(
        hashnft.connect(nodeBuyer).payForMint(proof, hashType, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(nodeBuyer.address, tokenId, trait, note)
    })

    it('success', async function () {
      await gotoPublicCollection()
      const trait = 2
      const hashrate = await hashnft.traitHashrates(trait)
      const tokenId = 0
      const amount = await hashnft.traitPrices(trait)

      let hashedAddress = ethers.utils.keccak256(buyer.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      await expect(
        hashnft.connect(buyer).payForMint(proof, trait, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer.address, tokenId, trait, note)

      expect(await hashnft.sold()).to.equal(hashrate)
      expect(await hashnft.ownerOf(tokenId)).to.equal(buyer.address)
      let costs = (await riskControl.price()).mul(hashrate)
      expect(await usdt.balanceOf(riskControl.address)).to.equal(costs)
      expect(await usdt.balanceOf(vault.address)).to.equal(amount.sub(costs))

      expect(await hashnft.sold()).to.equal(hashrate)
    })
  })

  describe('sell all', function () {
    it('success', async function () {
      await gotoPublicCollection()
      let tokenId = 0
      let amount = BigNumber.from(0)
      for (let trait = 0; trait < 3; trait++) {
        let balance = await hashnft.traitBalance(trait)
        while (balance > 0) {
          let hashedAddress = ethers.utils.keccak256(buyer.address)
          let proof = whiteListMerkleTree.getHexProof(hashedAddress)
          await expect(
            hashnft.connect(buyer).payForMint(proof, trait, note)
          ).to.emit(hashnft, 'HashNFTMint')
            .withArgs(buyer.address, tokenId, trait, note)
          tokenId += 1
          amount = amount.add(await hashnft.traitPrices(trait))
          balance = await hashnft.traitBalance(trait)
        }
      }
      let sold = await hashnft.sold()
      let costs = (await riskControl.price()).mul(sold)
      expect(await usdt.balanceOf(riskControl.address)).to.equal(costs)
      expect(await usdt.balanceOf(vault.address)).to.equal(amount.sub(costs))
    })
  })

  describe('riskcontrol::liquidate (address)', function () {
    it('revert error role', async function () {
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775`
      await expect(
        riskControl.connect(notAdmin).liquidate()
      ).to.be.revertedWith(revertMsg)
    })

    it('revert not the right stage', async function () {
      await expect(
        riskControl.connect(admin).liquidate()
      ).to.be.revertedWith('Stages: not the right stage')
    })

    it('success', async function () {
      await gotoPublicCollection()
      let note = "merlin"
      let hashedAddress = ethers.utils.keccak256(buyer.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      await expect(
        hashnft.connect(buyer).payForMint(proof, 0, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer.address, 0, 0, note)
      await expect(
        hashnft.connect(buyer2).payForMint(proof, 1, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer2.address, 1, 1, note)
      await expect(
        hashnft.connect(buyer3).payForMint(proof, 2, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer3.address, 2, 2, note)

      let balance = await usdt.balanceOf(riskControl.address)
      await gotoTimePoint(1)

      let tx = await riskControl.connect(admin).liquidate()
      let receipt = await tx.wait()
      let evt = receipt.events[receipt.events.length - 1]
      const addr = evt.args.liquidator
      let amount = evt.args.balance

      expect(await usdt.balanceOf(addr)).equal(balance)
      expect(amount).to.equal(balance)

      const LiquidatorContract = await ethers.getContractFactory("Liquidator")
      const liquidator = await LiquidatorContract.attach(addr)
      const price = await riskControl.price()
      let hashrate = await hashnft.traitHashrates(0)
      tx = await liquidator.claims(0)
      receipt = await tx.wait()
      evt = receipt.events[receipt.events.length - 1]
      const to = evt.args.to
      amount = evt.args.amount
      expect(to).equal(buyer.address)
      expect(hashrate.mul(price)).equal(amount)
    })

    it('revert already claimed', async function () {
      await gotoPublicCollection()
      let hashedAddress = ethers.utils.keccak256(buyer.address)
      let proof = whiteListMerkleTree.getHexProof(hashedAddress)
      let note = "merlin"
      await expect(
        hashnft.connect(buyer).payForMint(proof, 0, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer.address, 0, 0, note)
      await expect(
        hashnft.connect(buyer2).payForMint(proof, 1, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer2.address, 1, 1, note)
      await expect(
        hashnft.connect(buyer3).payForMint(proof, 2, note)
      ).to.emit(hashnft, 'HashNFTMint')
        .withArgs(buyer3.address, 2, 2, note)

      await gotoTimePoint(1)

      let tx = await riskControl.connect(admin).liquidate()
      let receipt = await tx.wait()
      let evt = receipt.events[receipt.events.length - 1]
      const addr = evt.args.liquidator

      const LiquidatorContract = await ethers.getContractFactory("Liquidator")
      const liquidator = await LiquidatorContract.attach(addr)
      await liquidator.claims(0)
      await expect(
        liquidator.claims(0)
      ).to.be.revertedWith('Liquidator: tokenId already claimed')
    })
  })
})

