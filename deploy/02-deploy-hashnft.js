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

  const wbtcDecimals = 8
  const wbtcTotalSupply = ethers.utils.parseEther('1000000000000000')
  await deployments.deploy('WBTC', {
    from: deployer.address,
    contract: 'MyERC20',
    log: true,
    args: ['Wrapper BTC', 'WBTC', wbtcTotalSupply, wbtcDecimals],
  });
  const wbtcToken = await ethers.getContract('WBTC')
  await wbtcToken.transfer(issuer.address, wbtcTotalSupply)

  await deployments.deploy('MockOracle', {
    from: deployer.address,
    args: [ethers.utils.parseEther('1')],
    log: true,
  });
  const priceOracle = await ethers.getContract('MockOracle')

  await deployments.deploy('BitcoinEarningsOracle', {
    from: deployer.address,
    log: true,
  });
  const earningOracle = await ethers.getContract('BitcoinEarningsOracle')
  await earningOracle.addTracker(deployer.address)

  const startTime_ = (await earningOracle.provider.getBlock()).timestamp + 100
  const payment = usdtToken.address
  const _cost = ethers.utils.parseEther('45')
  const _optionPercent = 500
  const _taxPercent = 1000

  await deployments.deploy('RiskControl', {
    from: deployer.address,
    args: [
      startTime_,
      _cost,
      _optionPercent,
      _taxPercent,
      payment,
      wbtcToken.address,
      issuer.address,
      priceOracle.address,
      earningOracle.address,
    ],
    log: true,
  })
  const riskControl = await ethers.getContract('RiskControl')
  const riskControlPrice = await riskControl.price()

  const bestBlock = await wbtcToken.provider.getBlock()
  const st = bestBlock.timestamp + 120// Math.ceil(bestBlock.timestamp / ONE_DAY) * ONE_DAY
  const hashrateTotalSupply = 10 * 1000; // 10PH/s
  const prices = [
    10,
    riskControlPrice.mul(10),
    20,
    riskControlPrice.mul(20),
    50,
    riskControlPrice.mul(50),
  ]
  await deployments.deploy('HashNFT', {
    from: deployer.address,
    args: [
      hashrateTotalSupply, 
      wbtcToken.address, 
      riskControl.address,
      prices,
      earningOracle.address, 
    ],
    log: true,
  });
  const hashNFT = await ethers.getContract('HashNFT')
  await riskControl.setHashNFT(hashNFT.address)

  await network.provider.send("evm_setNextBlockTimestamp", [st])
  await network.provider.send("evm_mine")

  await usdtToken.transfer(user.address, await usdtToken.balanceOf(deployer.address))
  await usdtToken.connect(user).approve(hashNFT.address, ethers.constants.MaxUint256)
  const nftType = 1
  await hashNFT.connect(user).payForMint(user.address, nftType, "")

  const collectionPeriodDuration = (await riskControl.collectionPeriodDuration()).toNumber()
  await network.provider.send('evm_setNextBlockTimestamp', [startTime_ + collectionPeriodDuration])

  await wbtcToken.connect(issuer).approve(riskControl.address, ethers.constants.MaxUint256)
  await network.provider.send('evm_setNextBlockTimestamp', [startTime_ + collectionPeriodDuration + ONE_DAY * 2])
  const tokenId = 0
  await hashNFT.connect(user).setUser(tokenId, user.address, startTime_ + collectionPeriodDuration + ONE_DAY * 3)
  
  await earningOracle.trackDailyEarnings([ethers.utils.parseUnits('0.0001', wbtcDecimals)], [1])
  await riskControl.deliver()

  const mtokenAddress = await hashNFT.mtoken()
  const mtoken = await ethers.getContractAt('mToken', mtokenAddress)
  await mtoken.connect(user).claims(tokenId)

  const code = await hashNFT.provider.getCode(mtokenAddress)
  const codehash = ethers.utils.keccak256(ethers.utils.arrayify(code))
  console.log('codehash', codehash)

  await deployments.deploy('mToken', {
    from: deployer.address,
    args: [
      usdtToken.address,
      hashNFT.address,
    ],
    log: true,
  });
  const liquidatemToken = await ethers.getContract('mToken')
  await riskControl.liquidate(liquidatemToken.address)
}

module.exports = func

func.tags = ['02']