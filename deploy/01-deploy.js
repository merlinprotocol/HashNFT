
async function func() {
  const [deployer, issuer, tracker, test] = await ethers.getSigners();
  console.log('deployer', deployer.address);
  const block = await ethers.provider.getBlock();
  const startAt = (Math.floor(block.timestamp / 3600 / 24) + 1) * 3600 * 24;
  //wbtc
  const decimals = 8;
  const wbtcSupply = ethers.utils.parseUnits('100000000', decimals);
  await deployments.deploy('WBTC', {
    from: deployer.address,
    contract: 'MyERC20',
    args: ["Wrapped Bitcoin", "wbtc", wbtcSupply, decimals],
    log: true
  });
  const wbtc = await ethers.getContract('WBTC');
  await wbtc.connect(deployer).transfer(issuer.address, wbtcSupply);
  //BitcoinEarningsOracle
  await deployments.deploy('BitcoinEarningsOracle', {
    from: deployer.address,
    contract: 'BitcoinEarningsOracle',
    log: true
  });
  const oracle = await ethers.getContract('BitcoinEarningsOracle');
  await oracle.addTracker(tracker.address);
  const f2poolHashrate = 31340
  const f2poolDailyEarnings = 450
  const antPoolHashrate = 201630
  const antPoolDailyEarnings = 427
  await oracle.connect(tracker).trackDailyEarnings([f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate]);

  //riskControlv2
  const duration = 3600 * 24 * 30;
  const supply = 8000;
  const price = ethers.utils.parseEther("0.001");
  const ratio = 7000;
  await deployments.deploy('RiskControl', {
    from: deployer.address,
    contract: 'RiskControlv2',
    args: [wbtc.address, issuer.address, price, supply, startAt, duration, ratio, oracle.address],
    log: true
  });
  const riskControl = await ethers.getContract('RiskControl');

  const mintTo = test.address 
  await deployments.deploy('NFT001', {
    from: deployer.address,
    contract: 'CustomerNFT',
    log: true,
    args: ["NFT001", "NFT001"]
  });
  const nft001 = await ethers.getContract('NFT001');
  await nft001.mint(mintTo);

  await deployments.deploy('NFT002', {
    from: deployer.address,
    contract: 'CustomerNFT',
    log: true,
    args: ["NFT002", "NFT002"]
  });
  const nft002 = await ethers.getContract('NFT002');
  await nft002.mint(mintTo);

  await deployments.deploy('NFT003', {
    from: deployer.address,
    contract: 'CustomerNFT',
    log: true,
    args: ["NFT003", "NFT003"]
  });
  const nft003 = await ethers.getContract('NFT003');
  await nft003.mint(mintTo);
}

module.exports = func

func.tags = ['01']