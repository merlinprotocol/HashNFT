const {
  ethers, network
} = require('hardhat')

const ONE_DAY = 3600*24

async function func() {
  const { deployments, network } = hre
  const [ deployer, issuer, user] = await ethers.getSigners()

  console.log('deployer', deployer.address)

  const usdtDecimals = 6
  const usdtTotalSupply = ethers.utils.parseEther('1000000000000000')
  await deployments.deploy('USDT', {
    from: deployer.address,
    contract: 'MyERC20',
    log: true,
    args: ['usdt', 'usdt', usdtTotalSupply, usdtDecimals],
  });
  const usdtToken = await ethers.getContract('USDT')

  const wbtcDecimals = 6
  const wbtcTotalSupply = ethers.utils.parseEther('1000000000000000')
  await deployments.deploy('WBTC', {
    from: deployer.address,
    contract: 'MyERC20',
    log: true,
    args: ['Wrapper BTC', 'WBTC', wbtcTotalSupply, wbtcDecimals],
  });
  const wbtcToken = await ethers.getContract('WBTC')
  await wbtcToken.transfer(issuer.address, wbtcTotalSupply)

  await deployments.deploy('BitcoinEarningsOracle', {
    from: deployer.address,
    log: true,
  });
  const oracle = await ethers.getContract('BitcoinEarningsOracle')
  await oracle.addTracker(deployer.address)

  const startTime_ = (await oracle.provider.getBlock()).timestamp
  const basePrice_ = ethers.utils.parseEther('45')
  const payment = usdtToken.address
  const priceOracle = oracle.address

  await deployments.deploy('RiskControl', {
    from: deployer.address,
    args: [
      startTime_,
      basePrice_,
      payment,
      issuer.address,
      priceOracle,
    ],
    log: true,
  })
  const riskControl = await ethers.getContract('RiskControl')

  const bestBlock = await wbtcToken.provider.getBlock()
  const st = bestBlock.timestamp + 120// Math.ceil(bestBlock.timestamp / ONE_DAY) * ONE_DAY
  const hashrateTotalSupply = 10 * 1000; // 10PH/s
  const price = 55 * 1e6;
  await deployments.deploy('HashNFT', {
    from: deployer.address,
    args: [
      hashrateTotalSupply, 
      usdtToken.address, 
      wbtcToken.address, 
      issuer.address,
      riskControl.address,
      oracle.address, 
    ],
    log: true,
  });
  const hashNFT = await ethers.getContract('HashNFT')

  const uri = "https://gateway.pinata.cloud/ipfs/QmXZY71Sw8JM14FXuFDpgfJ3eLyjzPbRq84FvLLssG2sRt"
  await hashNFT.setBaseURI(uri)

  await network.provider.send("evm_setNextBlockTimestamp", [st])
  await network.provider.send("evm_mine")

  await usdtToken.transfer(user.address, await usdtToken.balanceOf(deployer.address))
  await usdtToken.connect(user).approve(hashNFT.address, ethers.constants.MaxUint256)
  const nftType = 1
  await hashNFT.connect(user).functions['mint(address,uint8,string)'](user.address, nftType, "")

  const collectionPeriodDuration = (await riskControl.collectionPeriodDuration()).toNumber()
  await network.provider.send('evm_setNextBlockTimestamp', [startTime_ + collectionPeriodDuration])
  await oracle.complementDailyEarnings(10, [ethers.utils.parseEther('0.0023')], [1])

  await wbtcToken.connect(issuer).approve(hashNFT.address, ethers.constants.MaxUint256)
  await network.provider.send('evm_setNextBlockTimestamp', [startTime_ + collectionPeriodDuration + ONE_DAY * 2])
  const tokenId = 0
  await hashNFT.connect(user).setUser(tokenId, user.address, startTime_ + collectionPeriodDuration + ONE_DAY * 3)
  
  const mtokenAddress = await hashNFT.mtoken()
  const mtoken = await ethers.getContractAt('mToken', mtokenAddress)
  await mtoken.connect(user).claims(hashNFT.address, tokenId)

}

module.exports = func

func.tags = ['02']