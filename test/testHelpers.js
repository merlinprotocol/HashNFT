const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");

async function deployRiskControlv2(deployer, tracker, issuer, price, supply, startTime, duration, ratio) {
  const ERC20Contract = await ethers.getContractFactory("MyERC20");
  const decimals = 8;
  const wbtcSupply = ethers.utils.parseUnits('100000000', decimals);
  const wbtc = await ERC20Contract.connect(deployer).deploy("Wrapped Bitcoin", "wbtc", wbtcSupply, decimals);
  await wbtc.deployed();
  await wbtc.connect(deployer).transfer(issuer.address, wbtcSupply);
  RiskControlv2Contract = await ethers.getContractFactory("RiskControlv2");

  const eo = await deployBitcoinEarningsOracle(deployer, tracker)
  const instance = await RiskControlv2Contract.connect(deployer).deploy(
    wbtc.address,
    issuer.address,
    price,
    supply,
    startTime,
    duration,
    ratio,
    eo.address
  );
  await wbtc.connect(issuer).approve(instance.address, wbtcSupply);
  return instance;
}

async function deployBitcoinEarningsOracle(deployer, tracker) {
  const BitcoinEarningsOracleContract = await ethers.getContractFactory("BitcoinEarningsOracle");
  const eo = await BitcoinEarningsOracleContract.connect(deployer).deploy();
  await eo.deployed();

  await eo.addTracker(tracker.address);
  const f2poolHashrate = 31340
  const f2poolDailyEarnings = 450
  const antPoolHashrate = 201630
  const antPoolDailyEarnings = 427
  await eo.connect(tracker).trackDailyEarnings([f2poolDailyEarnings, antPoolDailyEarnings], [f2poolHashrate, antPoolHashrate]);
  return eo;
}

async function generateMerkleTree(account) {
  let addresses = [
    "0xeE2dac56D96F44Adf0515a8d3c88f4B64FC7321e", "0x2568D8FA520a0887D114CA9c99b8d205Cf61dBf6", "0x328b4fd30C4FaaDa2Ae10C750c75C5f04D2C8293",
    "0xBE830B967C6a13675cb24b35401564190b882D0E", "0xB1fcF46116022E401704Ad901bB52b486272f869", "0x1EE9ea5F314DedE44455650Ee56dAa42f1091A32",
    "0x8F05C04370aE2C7765A60390d21Bb10DF7603285", "0x74060EA11b7d820Dd54e8356bA8969b33F33B121", "0x29BEDc56E1CbF3ebbF8763C31f1814fF36a58ed4",
    "0x89b36C6058ec97496419BeAEC862d5B243b34c80", "0x3060A94E27b6f7A1Abe0dE2CbC90FFEc0b8D51a3", "0x425ce127A38Fb8D3De973d8aF8a5DCb4044adde1",
  ];
  addresses.push(account);
  let leaves = addresses.map(addr => ethers.utils.keccak256(addr));
  merkleTree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true });
  return merkleTree;
}

async function setBlockTimestamp(timepoint) {
  await network.provider.send('evm_setNextBlockTimestamp', [timepoint])
  await ethers.provider.send("evm_mine")
}

async function getBlockTimestamp() {
  const block = await ethers.provider.getBlock();
  return block.timestamp;
}

async function deliverAll(riskControl, oracle, issuer, startTime) {
  const deliverTimer = (await riskControl.duration()).div(3600 * 24);
  const splitterAddr = await riskControl.splitter();
  const result = await oracle.lastRound();
  const rewardsAmount = (result[1]).mul(await riskControl.sold());
  for (let i = 1; i <= deliverTimer; i++) {
    await setBlockTimestamp(startTime + 24 * 3600 * i);
    const ACTIVE = 1;
    expect(await riskControl.currentStage()).to.equal(ACTIVE);
    await expect(
      riskControl.deliver()
    ).to.emit(riskControl, 'Deliver')
      .withArgs(issuer.address, splitterAddr, rewardsAmount);
  }
}

module.exports = {
  deployRiskControlv2,
  deployBitcoinEarningsOracle,
  generateMerkleTree,
  getBlockTimestamp,
  setBlockTimestamp,
  deliverAll,
};