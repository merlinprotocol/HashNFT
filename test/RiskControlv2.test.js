// test/RiskControlv2.test.js
// Load dependencies

const { expect } = require("chai");
const { deployRiskControlv2, getBlockTimestamp, setBlockTimestamp, deliverAll } = require("./testHelpers");

describe("RiskControlv2", function () {
  let riskControl;
  let hashNFTv2;
  let deployer;
  let admin;
  let notAdmin;
  let test;
  let issuer;
  let users;
  let startAt;
  let oracle;
  const duration = 3600 * 24 * 30;
  const supply = 4000;
  const price = ethers.utils.parseEther("0.001");
  const ratio = 3000;
  const hashrates = [1000, 500, 1000, 1000];

  const INACTIVE = 0;
  const ACTIVE = 1;
  const MATURED = 2;
  const DEFAULTED = 3;

  beforeEach(async function () {
    [deployer, tracker, issuer, user1, user2, user3, user4, notAdmin, test] = await ethers.getSigners();
    admin = deployer;
    startAt = (Math.floor(await getBlockTimestamp() / 3600 / 24) + 1) * 3600 * 24;

    const NFTSVGContract = await ethers.getContractFactory("NFTSVG");
    svg = await NFTSVGContract.deploy();
    await svg.deployed();
    riskControl = await deployRiskControlv2(deployer, tracker, issuer, price, supply, startAt, duration, ratio);
    const HashNFTv2Contract = await ethers.getContractFactory("HashNFTv2", {
      libraries: {
        NFTSVG: svg.address,
      },
    });
    const BitcoinEarningsOracleContract = await ethers.getContractFactory("BitcoinEarningsOracle");
    oracle = await BitcoinEarningsOracleContract.attach(await riskControl.earningsOracle());
    hashNFTv2 = await HashNFTv2Contract.deploy(riskControl.address);
    await hashNFTv2.deployed();

    users = [user1, user2, user3, user4];
    for (let i = 0; i < hashrates.length; i++) {
      const balance = price.mul(hashrates[i]);
      await hashNFTv2.connect(users[i]).functions["mint(uint256,address)"](hashrates[i], users[i].address, { value: balance });
    }
  });

  async function claimInitialPayment() {
    await setBlockTimestamp(startAt);
    let amount = await ethers.provider.getBalance(riskControl.address);
    amount = amount.mul(ratio).div(10000);
    expect(await riskControl.currentStage()).to.equal(ACTIVE);
    await expect(
      riskControl.connect(issuer).claimInitialPayment()
    ).to.emit(riskControl, 'ClaimInitialPayment')
      .withArgs(issuer.address, amount);
  }

  describe("RiskControlv2 deployment", function () {
    it("should deploy with correct parameters", async function () {
      // Add test cases for verifying constructor parameters
      expect(await riskControl.startTime()).to.equal(startAt);
      expect(await riskControl.duration()).to.equal(duration);
      expect(await riskControl.supply()).to.equal(supply);
      expect(await riskControl.initialPaymentRatio()).to.equal(ratio);
      expect(await riskControl.mintAllowed()).to.equal(true);
      expect(await riskControl.price()).to.equal(price);
    });
  });

  describe("currentStage functionality", function () {
    it("should correctly return the stage of riskControl", async function () {
      expect(await riskControl.currentStage()).to.equal(INACTIVE);
      await setBlockTimestamp(startAt);
      expect(await riskControl.currentStage()).to.equal(ACTIVE);
      await setBlockTimestamp(startAt + 2 * 24 * 3600);
      expect(await riskControl.currentStage()).to.equal(DEFAULTED);
    });
  });

  describe("Deliver functionality", function () {
    it('revert not the stage', async function () {
      expect(await riskControl.currentStage()).to.equal(INACTIVE);
      await expect(
        riskControl.deliver()
      ).to.be.revertedWith('RiskControl: not the stage');
    });

    it('deliver conditions not met', async function () {
      await setBlockTimestamp(startAt);
      await expect(
        riskControl.deliver()
      ).to.be.revertedWith('RiskControl: deliver conditions not met');
    });

    it("should correctly Deliver for all duration", async function () {
      await deliverAll(riskControl, oracle, issuer, startAt);
      await setBlockTimestamp(startAt + duration + 3600 * 24 + 1);
      expect(await riskControl.currentStage()).to.equal(MATURED);
    });
  });

  describe("SetIssuer functionality", function () {
    it('revert insufficient permissions', async function () {
      const role = await riskControl.DEFAULT_ADMIN_ROLE();
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(notAdmin).setIssuer(test.address)
      ).to.be.revertedWith(revertMsg);
    });

    it("should correctly SetIssuer", async function () {
      await expect(
        riskControl.connect(admin).setIssuer(test.address)
      ).to.emit(riskControl, 'IssuerHasChanged')
        .withArgs(issuer.address, test.address);
    });
  });

  describe("Bind functionality", function () {
    async function bind(amount, signer, tokenId) {
      const hashrates = await riskControl.hashrate(hashNFTv2.address, tokenId);
      expect(await hashNFTv2.ownerOf(tokenId)).to.equal(signer.address);
      await expect(
        riskControl.connect(signer).bind(hashNFTv2.address, tokenId, amount, { value: amount.mul(price) })
      ).to.emit(riskControl, 'Bind')
        .withArgs(hashNFTv2.address, tokenId, amount);
      expect(await riskControl.hashrate(hashNFTv2.address, tokenId)).to.equal(hashrates.add(amount));
    }

    it('should correctly Bind', async function () {
      const amount = (await riskControl.supply()).sub(await riskControl.sold());
      const tokenId = 0;
      await bind(amount, user1, tokenId);
    });

    it('revert insufficient hashrates', async function () {
      const amount = (await riskControl.supply()).sub(await riskControl.sold()).add(1);
      const tokenId = 0;
      await expect(
        riskControl.connect(user1).bind(hashNFTv2.address, tokenId, amount, { value: amount.mul(price) })
      ).to.be.revertedWith("RiskControl: insufficient hashrates");
    });

    it('revert insufficient ether', async function () {
      const amount = (await riskControl.supply()).sub(await riskControl.sold());
      const tokenId = 0;
      await expect(
        riskControl.connect(user1).bind(hashNFTv2.address, tokenId, amount, { value: amount.mul(price).sub(1) })
      ).to.be.revertedWith("RiskControl: insufficient ether");
    });
  });

  describe("MintAllowed functionality", function () {
    it('should correctly MintAllowed', async function () {
      expect(await riskControl.mintAllowed()).to.equal(true);
      await setBlockTimestamp(startAt);
      expect(await riskControl.mintAllowed()).to.equal(false);
      await setBlockTimestamp(startAt + duration);
      expect(await riskControl.mintAllowed()).to.equal(false);
    });
  });

  describe("Hashrate functionality", function () {
    it('should correctly Hashrate', async function () {
      for (let tokenId = 0; tokenId < hashrates.length; tokenId++) {
        expect(await riskControl.hashrate(hashNFTv2.address, tokenId)).to.equal(hashrates[tokenId]);
      }
    });
  });

  describe("RewardBalance functionality", function () {
    it('should correctly RewardBalance', async function () {
      await setBlockTimestamp(startAt + 24 * 3600 + 1);
      expect(await riskControl.currentStage()).to.equal(ACTIVE);
      await riskControl.deliver();
      const [_, earning] = await oracle.lastRound();
      const tokenId = 0;
      const sum = hashrates.reduce((acc, curr) => acc + curr, 0);
      const value = earning.mul(await riskControl.sold()).mul(hashrates[tokenId]).div(sum);
      expect(await riskControl.rewardBalance(hashNFTv2.address, tokenId)).to.equal(value);
      expect(await riskControl.rewardBalance(hashNFTv2.address, 100)).to.equal(0);
    });
  });

  describe("Release(address,uint256) functionality", function () {
    it('revert statu not in MATURED or DEFAULTED', async function () {
      const tokenId = 0;
      await expect(
        riskControl.connect(user1).functions["release(address,uint256)"](hashNFTv2.address, tokenId)
      ).to.be.revertedWith("RiskControl: statu not in MATURED or DEFAULTED");
    });

    it('revert not auth', async function () {
      await setBlockTimestamp(startAt + 48 * 3600 + 1);
      expect(await riskControl.currentStage()).to.equal(DEFAULTED);
      const tokenId = 0;
      await expect(
        riskControl.connect(user1).functions["release(address,uint256)"](hashNFTv2.address, tokenId)
      ).to.be.revertedWith("RiskControl: not auth");
    });
  });

  describe("Release(address,address,uint256) functionality", function () {
    it('revert statu not in MATURED or DEFAULTED', async function () {
      const tokenId = 0;
      const rewards = await riskControl.rewards();
      await expect(
        riskControl.connect(user1).functions["release(address,address,uint256)"](rewards, hashNFTv2.address, tokenId)
      ).to.be.revertedWith("RiskControl: statu not in MATURED or DEFAULTED");
    });

    it('revert not auth', async function () {
      await setBlockTimestamp(startAt + 48 * 3600 + 1);
      expect(await riskControl.currentStage()).to.equal(DEFAULTED);
      const tokenId = 0;
      const rewards = await riskControl.rewards();
      await expect(
        riskControl.connect(user1).functions["release(address,address,uint256)"](rewards, hashNFTv2.address, tokenId)
      ).to.be.revertedWith("RiskControl: not auth");
    });
  });

  describe("ClaimInitialPayment functionality", function () {
    it('should correctly ClaimInitialPayment', async function () {
      await claimInitialPayment();
    });

    it('revert initialPayment already claimed', async function () {
      await claimInitialPayment();
      await expect(
        riskControl.connect(issuer).claimInitialPayment()
      ).to.be.revertedWith("RiskControl: initialPayment already claimed");
    });

    it('revert insufficient permissions', async function () {
      await setBlockTimestamp(startAt);
      const role = await riskControl.ISSUER_ROLE();
      const revertMsg = `AccessControl: account ${admin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(admin).claimInitialPayment()
      ).to.be.revertedWith(revertMsg);
    });
  });

  describe("Withdraw functionality", function () {
    it('should correctly ClaimInitialPayment', async function () {
      await claimInitialPayment();
      await deliverAll(riskControl, oracle, issuer, startAt);
      await setBlockTimestamp(startAt + 24 * 3600 + duration + 1);
      expect(await riskControl.currentStage()).to.equal(MATURED);
      await riskControl.connect(issuer).withdraw();
      expect(await ethers.provider.getBalance(riskControl.address)).to.equal(0);
    });

    it('revert initial payment not claimed', async function () {
      await deliverAll(riskControl, oracle, issuer, startAt);
      await setBlockTimestamp(startAt + 24 * 3600 + duration + 1);
      await expect(
        riskControl.connect(issuer).withdraw()
      ).to.be.revertedWith("RiskControl: initial payment not claimed");
    });

    it('revert insufficient permissions', async function () {
      await setBlockTimestamp(startAt);
      const role = await riskControl.ISSUER_ROLE();
      const revertMsg = `AccessControl: account ${admin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(admin).withdraw()
      ).to.be.revertedWith(revertMsg);
    });
  });

  describe("Liquidate functionality", function () {
    it('should correctly Liquidate', async function () {
      await setBlockTimestamp(startAt + 48 * 3600 + 1);
      expect(await riskControl.currentStage()).to.equal(DEFAULTED);
      const splitter = await riskControl.splitter();
      expect(await ethers.provider.getBalance(splitter)).to.equal(0);
      const amount = await ethers.provider.getBalance(riskControl.address);
      await expect(
        riskControl.connect(admin).liquidate()
      ).to.emit(riskControl, 'Liquidate')
        .withArgs(splitter, amount);

      const tokenId = 0;
      const sum = hashrates.reduce((acc, curr) => acc + curr, 0);
      const value = amount.mul(hashrates[tokenId]).div(sum);
      expect(await riskControl.funds(hashNFTv2.address, tokenId)).to.equal(value);
    });

    it('should correctly Liquidate 2', async function () {
      await claimInitialPayment();
      await setBlockTimestamp(startAt + 48 * 3600 + 1);
      expect(await riskControl.currentStage()).to.equal(DEFAULTED);
      const splitter = await riskControl.splitter();
      expect(await ethers.provider.getBalance(splitter)).to.equal(0);
      const amount = await ethers.provider.getBalance(riskControl.address);
      await expect(
        riskControl.connect(admin).liquidate()
      ).to.emit(riskControl, 'Liquidate')
        .withArgs(splitter, amount);
    });

    it('revert not the stage', async function () {
      await expect(
        riskControl.connect(admin).liquidate()
      ).to.be.revertedWith("RiskControl: not the stage");
    });

    it('revert insufficient permissions', async function () {
      await setBlockTimestamp(startAt);
      const role = await riskControl.DEFAULT_ADMIN_ROLE();
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        riskControl.connect(notAdmin).liquidate()
      ).to.be.revertedWith(revertMsg);
    });
  });
});