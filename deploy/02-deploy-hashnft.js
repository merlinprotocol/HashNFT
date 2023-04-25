const { ethers } = require('hardhat')
const MerkleTree = require('merkletreejs').MerkleTree
const SHA256 = require('crypto-js/sha256')

async function func() {
  const { deployments } = hre
  const [deployer, issuer, tracker] = await ethers.getSigners();
  console.log('deployer', deployer.address);
  const block = await ethers.provider.getBlock();
  const startAt = (Math.floor(block.timestamp / 3600 / 24) + 1) * 3600 * 24;

  await deployments.deploy('NFTSVG', {
    from: deployer.address,
    contract: 'NFTSVG',
    log: true
  });
  const nftsvg = await ethers.getContract('NFTSVG');
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
  const supply = 4000;
  const price = ethers.utils.parseEther("0.001");
  const ratio = 3000;
  await deployments.deploy('RiskControl', {
    from: deployer.address,
    contract: 'RiskControlv2',
    args: [wbtc.address, issuer.address, price, supply, startAt, duration, ratio, oracle.address],
    log: true
  });
  const riskControl = await ethers.getContract('RiskControl');
  //hashnftv2
  await deployments.deploy('HashNFT', {
    from: deployer.address,
    contract: 'HashNFTv2',
    args: [riskControl.address],
    libraries: {
      NFTSVG: nftsvg.address,
    },
    log: true
  });
  const hashnft = await ethers.getContract('HashNFT');
  const whitelistSupply = 200;
  deployer.sendTransaction({
    to: hashnft.address,
    value: price.mul(whitelistSupply),
  });
  const whitelistLimit = 2;
  await hashnft.setWhitelistSupply(whitelistSupply);
  await hashnft.setWhitelistLimit(whitelistLimit);
  let accounts = [
    "0xeE2dac56D96F44Adf0515a8d3c88f4B64FC7321e", "0x2568D8FA520a0887D114CA9c99b8d205Cf61dBf6", "0x328b4fd30C4FaaDa2Ae10C750c75C5f04D2C8293",
    "0xBE830B967C6a13675cb24b35401564190b882D0E", "0xB1fcF46116022E401704Ad901bB52b486272f869", "0x1EE9ea5F314DedE44455650Ee56dAa42f1091A32",
    "0x8F05C04370aE2C7765A60390d21Bb10DF7603285", "0x74060EA11b7d820Dd54e8356bA8969b33F33B121", "0x29BEDc56E1CbF3ebbF8763C31f1814fF36a58ed4",
    "0x89b36C6058ec97496419BeAEC862d5B243b34c80", "0x3060A94E27b6f7A1Abe0dE2CbC90FFEc0b8D51a3", "0x425ce127A38Fb8D3De973d8aF8a5DCb4044adde1",
  ];
  let leaves = accounts.map(addr => ethers.utils.keccak256(addr));
  let merkleTree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true });
  await hashnft.setWhiteListRootHash(merkleTree.getRoot());
}

module.exports = func

func.tags = ['02']