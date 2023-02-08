const { ethers } = require('hardhat')

const ONE_DAY = 3600 * 24

async function func() {
  const { deployments } = hre
  const [deployer, issuer, vault, buyer1, buyer2, buyer3] = await ethers.getSigners()

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

  await deployments.deploy('MockEarningsOracle', {
    from: deployer.address,
    log: true,
  })
  const earingsOracle = await ethers.getContract('MockEarningsOracle')

  const BTCPrice = ethers.utils.parseUnits('38500', wbtcDecimals)
  await deployments.deploy('MockOracle', {
    from: deployer.address,
    args: [BTCPrice],
    log: true,
  })
  mockOracle = await ethers.getContract('MockOracle')

  let day = (await earingsOracle.provider.getBlock()).timestamp / 3600 / 24
  day = Math.floor(day)
  const startTime = (day + 1) * 3600 * 24
  console.log("startTime:", startTime)
  const cost = ethers.utils.parseEther('20000000')
  const payment = usdtToken.address
  const optionPercent = 500
  const taxPercent = 500
  console.log(startTime,
    cost,
    optionPercent,
    taxPercent,
    payment,
    wbtcToken.address,
    issuer.address,
    mockOracle.address,
    earingsOracle.address)
  
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
      earingsOracle.address
    ],
    log: true,
  })
  const riskControl = await ethers.getContract('RiskControl')

  const hashrateTotalSupply = 50 * 1000 // 10PH/s
  const prices = [
    10,
    ethers.utils.parseEther('269000000'),
    20,
    ethers.utils.parseEther('499000000'),
    40,
    ethers.utils.parseEther('999000000')
  ]
  // await deployments.deploy('HashNFT', {
  //   from: deployer.address,
  //   args: [
  //     hashrateTotalSupply,
  //     wbtcToken.address,
  //     riskControl.address,
  //     prices,
  //     vault.address
  //   ],
  //   log: true,
  // })
  const HashNFTContract = await ethers.getContractFactory("HashNFT")
  const hashnft = await HashNFTContract.connect(deployer).deploy( hashrateTotalSupply,
    wbtcToken.address,
    riskControl.address,
    prices,
    vault.address)

  let tx = await riskControl.setHashNFT(hashnft.address)
  tx.wait()
  console.log("set hashnft tx =", tx.hash)

  await network.provider.send('evm_setNextBlockTimestamp', [startTime])
  await ethers.provider.send("evm_mine")

  let amount = await usdtToken.totalSupply()
  amount = amount.div(3)
  await usdtToken.connect(deployer).transfer(buyer1.address, amount)
  await usdtToken.connect(deployer).connect(buyer1).approve(hashnft.address, amount)

  await usdtToken.connect(deployer).transfer(buyer2.address, amount)
  await usdtToken.connect(deployer).connect(buyer2).approve(hashnft.address, amount)

  await usdtToken.connect(deployer).transfer(buyer3.address, amount)
  await usdtToken.connect(deployer).connect(buyer3).approve(hashnft.address, amount)

  let note = "test"
  await hashnft.connect(buyer1).payForMint(buyer1.address, 0, note)
  await hashnft.connect(buyer2).payForMint(buyer2.address, 1, note)
  await hashnft.connect(buyer3).payForMint(buyer3.address, 2, note)
  console.log("buyer1:", buyer1.address)
  console.log("buyer2:", buyer2.address)
  console.log("buyer3:", buyer3.address)


  await wbtcToken.connect(issuer).approve(riskControl.address, wbtcTotalSupply)

  let timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + 1 * 3600 * 24
  await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
  await ethers.provider.send("evm_mine")
  await riskControl.connect(issuer).deliver()

  timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + 2 * 3600 * 24
  await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
  await ethers.provider.send("evm_mine")
  await riskControl.connect(issuer).deliver()
  
  timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + 3 * 3600 * 24
  await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
  await ethers.provider.send("evm_mine")
  await riskControl.connect(issuer).deliver()
  
  timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + 4 * 3600 * 24
  await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
  await ethers.provider.send("evm_mine")
  await riskControl.connect(issuer).deliver()
  
  timepoint = startTime + (await riskControl.collectionPeriodDuration()).toNumber() + 5 * 3600 * 24
  await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
  await ethers.provider.send("evm_mine")
  await riskControl.connect(issuer).deliver()
}

module.exports = func

func.tags = ['02']