const {
  ethers, network
} = require('hardhat')

const ONE_DAY = 3600 * 24

async function func() {
  const { deployments, network } = hre
  const [deployer, issuer, user, vault] = await ethers.getSigners()

  console.log('deployer', deployer.address)

  const usdtDecimals = 6
  const usdtTotalSupply = ethers.utils.parseEther('1000000000000000')
  await deployments.deploy('USDT', {
    from: deployer.address,
    contract: 'MyERC20',
    log: true,
    args: ['usdt', 'usdt', usdtTotalSupply, usdtDecimals],
  })
  const usdtToken = await ethers.getContract('USDT')

  const wbtcDecimals = 6
  const wbtcTotalSupply = ethers.utils.parseEther('1000000000000000')
  await deployments.deploy('WBTC', {
    from: deployer.address,
    contract: 'MyERC20',
    log: true,
    args: ['Wrapper BTC', 'WBTC', wbtcTotalSupply, wbtcDecimals],
  })
  const wbtcToken = await ethers.getContract('WBTC')
  await wbtcToken.transfer(issuer.address, wbtcTotalSupply)

  await deployments.deploy('BitcoinEarningsOracle', {
    from: deployer.address,
    log: true,
  })
  const oracle = await ethers.getContract('BitcoinEarningsOracle')
  await oracle.addTracker(deployer.address)

  const BTCPrice = ethers.utils.parseUnits('38500', wbtcDecimals)
  await deployments.deploy('MockOracle', {
    from: deployer.address,
    args: [BTCPrice],
  })
  mockOracle = await ethers.getContract('MockOracle')

  const startTime = (await oracle.provider.getBlock()).timestamp
  const cost = ethers.utils.parseEther('45')
  const payment = usdtToken.address
  const optionPercent = 500
  const taxPercent = 500
  await deployments.deploy('RiskControl', {
    from: deployer.address,
    args: [
      startTime,
      cost,
      optionPercent,
      taxPercent,
      payment,
      wbtcToken.address,
      issuer.address,
      mockOracle.address,
      oracle.address
    ],
    log: true,
  })
  const riskControl = await ethers.getContract('RiskControl')

  const bestBlock = await wbtcToken.provider.getBlock()
  const st = bestBlock.timestamp + Math.ceil(bestBlock.timestamp / ONE_DAY) * (ONE_DAY + 1)
  const hashrateTotalSupply = 50 * 1000 // 10PH/s
  const prices = [
    10,
    ethers.utils.parseEther('269000000'),
    20,
    ethers.utils.parseEther('499000000'),
    40,
    ethers.utils.parseEther('999000000')
  ]
  await deployments.deploy('HashNFT', {
    from: deployer.address,
    args: [
      hashrateTotalSupply,
      wbtcToken.address,
      riskControl.address,
      prices,
      vault.address
    ],
    log: true,
  })
}

module.exports = func

func.tags = ['02']