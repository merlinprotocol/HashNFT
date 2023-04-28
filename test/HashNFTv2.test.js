// test/HashNFTv2.test.js
// Load dependencies

const { expect } = require("chai");
const { deployRiskControlv2,
  generateMerkleTree,
  getBlockTimestamp,
  setBlockTimestamp,
  deliverAll } = require("./testHelpers");

describe("HashNFTv2", function () {
  let hashNFTv2;
  let svg;
  let riskControl;
  let oracle;
  let deployer;
  let admin;
  let notAdmin;
  let issuer;
  let whitelistUser;
  let user;
  let users;
  let merkleTree;

  let startAt;
  const duration = 3600 * 24 * 30;
  const hashrates = [1000, 500, 1000, 1000];
  const supply = 4000;
  const price = ethers.utils.parseEther("0.001");
  const ratio = 3000;
  const whitelistSupply = 200;
  const whitelistLimit = 2;
  const INACTIVE = 0;
  const ACTIVE = 1;
  const MATURED = 2;
  const DEFAULTED = 3;

  async function whitelistMint(signer, count) {
    const balance = await ethers.provider.getBalance(hashNFTv2.address);
    if (balance < price) {
      await deployer.sendTransaction({
        to: hashNFTv2.address,
        value: price.mul(whitelistSupply),
      });
    }
    const hashedAddress = ethers.utils.keccak256(signer.address);
    let proof = merkleTree.getHexProof(hashedAddress);

    let tokenId = 0;
    for (let i = 0; i < count; i++) {
      await expect(
        await hashNFTv2.connect(signer).functions["mint(bytes32[],uint256,address)"](proof, 0, signer.address)
      ).to.emit(hashNFTv2, 'Transfer')
        .withArgs(ethers.constants.AddressZero, signer.address, tokenId);
      expect(await hashNFTv2.ownerOf(tokenId)).to.equal(signer.address);
      tokenId += 1;
    }
    expect(await hashNFTv2.whitelistMinted()).to.equal(count);
    expect(await ethers.provider.getBalance(riskControl.address)).to.equal(price.mul(count));
  }

  async function mint(signer, amounts) {
    let tokenId = 0;
    let sold = 0;
    for (const amount of amounts) {
      const balance = (await riskControl.price()).mul(amount);
      await expect(
        await hashNFTv2.connect(signer).functions["mint(uint256,address)"](amount, signer.address, { value: balance })
      ).to.emit(hashNFTv2, 'Transfer')
        .withArgs(ethers.constants.AddressZero, signer.address, tokenId);
      expect(await hashNFTv2.ownerOf(tokenId)).to.equal(signer.address);
      tokenId += 1;
      sold += amount;
    }
    expect(await riskControl.sold()).to.equal(sold);
  }

  beforeEach(async function () {
    [deployer, tracker, issuer, whitelistUser, user, user1, user2, user3, user4, notAdmin] = await ethers.getSigners();
    admin = deployer;
    users = [user1, user2, user3, user4];
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
    await hashNFTv2.setWhitelistSupply(whitelistSupply);
    await hashNFTv2.setWhitelistLimit(whitelistLimit);
    merkleTree = await generateMerkleTree(whitelistUser.address);
    await hashNFTv2.setWhiteListRootHash(merkleTree.getRoot());
  });

  describe("HashNFTv2 deployment", function () {
    it("should deploy with correct parameters", async function () {
      // Add test cases for verifying constructor parameters
      expect(await hashNFTv2.whitelistSupply()).to.equal(whitelistSupply);
      expect(await hashNFTv2.whitelistLimit()).to.equal(whitelistLimit);
      expect(await hashNFTv2.whitelistMinted()).to.equal(0);
      expect(await hashNFTv2.riskControl()).to.equal(riskControl.address);
      expect(await hashNFTv2.whiteListRootHash()).to.equal(merkleTree.getHexRoot());
      expect(await hashNFTv2.name()).to.equal("Hash NFT v2");
      expect(await hashNFTv2.symbol()).to.equal("HASHNFTv2");

      expect(await riskControl.startTime()).to.equal(startAt);
      expect(await riskControl.mintAllowed()).to.equal(true);
    });
  });

  describe("Mint(bytes32[],uint256,address) functionality", function () {
    it("should correctly mint tokens for Mint", async function () {
      await whitelistMint(whitelistUser, 1);
    });

    it("should correctly mint tokens for Mint 2", async function () {
      const balance = await ethers.provider.getBalance(hashNFTv2.address);
      if (balance < price) {
        await deployer.sendTransaction({
          to: hashNFTv2.address,
          value: price,
        });
      }
      const hashedAddress = ethers.utils.keccak256(whitelistUser.address);
      let proof = merkleTree.getHexProof(hashedAddress);

      const tokenId = 0;
      const amount = 1;
      const payAmount = price.mul(amount);
      await expect(
        hashNFTv2.connect(whitelistUser).functions["mint(bytes32[],uint256,address)"](proof, amount, whitelistUser.address, { value: payAmount })
      ).to.emit(hashNFTv2, 'Transfer')
        .withArgs(ethers.constants.AddressZero, whitelistUser.address, tokenId);
      expect(await hashNFTv2.ownerOf(tokenId)).to.equal(whitelistUser.address);

      expect(await hashNFTv2.whitelistMinted()).to.equal(1);
      expect(await ethers.provider.getBalance(riskControl.address)).to.equal(price.mul(amount + 1));
    });

    it('revert mint not allow', async function () {
      await setBlockTimestamp(startAt);
      await expect(
        whitelistMint(whitelistUser, 1)
      ).to.be.revertedWith('HashNFTv2: mint not allow');
    });

    it('revert caller is not in whitelist', async function () {
      await expect(
        whitelistMint(user, 1)
      ).to.be.revertedWith('HashNFTv2: caller is not in whitelist');
    });

    it('revert insufficient whitelist', async function () {
      await expect(
        whitelistMint(whitelistUser, 3)
      ).to.be.revertedWith('HashNFTv2: insufficient whitelist');
    });

    it('revert insufficient whitelist 2', async function () {
      await hashNFTv2.setWhitelistSupply(1);
      await expect(
        whitelistMint(whitelistUser, 2)
      ).to.be.revertedWith('HashNFTv2: insufficient whitelist');
    });

    it('revert insufficient funds', async function () {
      expect(await ethers.provider.getBalance(hashNFTv2.address)).to.equal(0);
      const hashedAddress = ethers.utils.keccak256(whitelistUser.address);
      let proof = merkleTree.getHexProof(hashedAddress);
      await expect(
        hashNFTv2.connect(whitelistUser).functions["mint(bytes32[],uint256,address)"](proof, 0, whitelistUser.address)
      ).to.be.revertedWith('HashNFTv2: insufficient funds');
    });
  });

  describe("Mint(uint256,address) functionality", function () {
    it("should correctly mint tokens", async function () {
      // Add test cases for minting tokens
      await mint(user, [10]);
    });

    it('revert balanceOf is not zero', async function () {
      await mint(user, [10]);
      const amount = 10;
      const balance = (await riskControl.price()).mul(amount);
      expect(await hashNFTv2.balanceOf(user.address)).to.equal(1);
      await expect(
        hashNFTv2.connect(user).functions["mint(uint256,address)"](amount, user.address, { value: balance })
      ).to.be.revertedWith('HashNFTv2: balanceOf not zero');
    });

    it('revert mint not allow', async function () {
      await setBlockTimestamp(startAt);
      await expect(
        mint(user, [10])
      ).to.be.revertedWith('HashNFTv2: mint not allow');
    });

    it('revert insufficient hashrate', async function () {
      await mint(user, [(await riskControl.supply())]);
      await expect(
        mint(user2, [1])
      ).to.be.revertedWith('HashNFTv2: insufficient hashrate');
    });
  });

  describe("TokenURI functionality", function () {
    it("should return correct tokenURI", async function () {
      const writeSvg = false;
      // Add test cases for tokenURI functionality
      const PriceOraceContract = await ethers.getContractFactory("MockAggregatorV3Interface");
      const po = await PriceOraceContract.connect(deployer).deploy();
      await po.deployed();
      await hashNFTv2.connect(admin).setPriceFeedAddress(po.address);
      expect(await hashNFTv2.priceFeedAddress()).to.eq(po.address);

      await mint(user, [10]);
      const tokenId = 0;
      let metadata = await hashNFTv2.tokenURI(tokenId);
      let regex = /^data:application\/json;base64,([\w\d+/]+=*)/i;
      let match = metadata.match(regex);
      let base64String = match[1];
      let decodedData = Buffer.from(base64String, "base64");
      const parsedJson = JSON.parse(decodedData);

      metadata = parsedJson.image;
      regex = /^data:image\/svg\+xml;base64,([\w\d+/]+=*)/i;
      match = metadata.match(regex);
      base64String = match[1];
      decodedData = Buffer.from(base64String, "base64");
      if (writeSvg) {
        const outputPath = "hashnft.svg";
        const fs = require("fs");
        fs.writeFileSync(outputPath, decodedData);
      }
    });
  });

  describe("Withdraw functionality", function () {
    it("should correctly Withdraw", async function () {
      // Add test cases for withdraw functionality
      await whitelistMint(whitelistUser, 2);
      const balance = await ethers.provider.getBalance(hashNFTv2.address);
      await expect(
        hashNFTv2.connect(admin).withdraw()
      ).to.emit(hashNFTv2, 'Withdraw')
        .withArgs(admin.address, balance);
      expect(await ethers.provider.getBalance(hashNFTv2.address)).to.equal(0);
    });

    it("revert insufficient permissions", async function () {
      const role = await riskControl.DEFAULT_ADMIN_ROLE()
      const revertMsg = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${role}`
      await expect(
        hashNFTv2.connect(notAdmin).withdraw()
      ).to.be.revertedWith(revertMsg)
    });
  });

  describe("Burn functionality", function () {
    async function mockDeliver() {
      for (let i = 0; i < hashrates.length; i++) {
        const balance = price.mul(hashrates[i]);
        await hashNFTv2.connect(users[i]).functions["mint(uint256,address)"](hashrates[i], users[i].address, { value: balance });
      }
      await deliverAll(riskControl, oracle, issuer, startAt);
      await setBlockTimestamp(startAt + duration + 3600 * 24 + 1);
      expect(await riskControl.currentStage()).to.equal(MATURED);
    }

    it("should correctly Burn", async function () {
      await mockDeliver();

      const tokenId = 0;
      expect(await hashNFTv2.ownerOf(tokenId)).to.eq(users[tokenId].address);
      const [_, earning] = await oracle.lastRound();
      const amount = earning.mul(hashrates[tokenId]).mul(duration / 3600 / 24);
      expect(await riskControl.rewardBalance(hashNFTv2.address, tokenId)).to.eq(amount);
      await hashNFTv2.connect(users[tokenId]).burn(tokenId);
      const ERC20Contract = await ethers.getContractFactory("MyERC20");
      const wbtc = await ERC20Contract.attach(await riskControl.rewards());
      expect(await wbtc.balanceOf(users[tokenId].address)).to.eq(amount);
      await expect(
        hashNFTv2.ownerOf(tokenId)
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it("should correctly Burn 2", async function () {
      for (let i = 0; i < hashrates.length; i++) {
        const balance = price.mul(hashrates[i]);
        await hashNFTv2.connect(users[i]).functions["mint(uint256,address)"](hashrates[i], users[i].address, { value: balance });
      }
      const deliverTimer = 10;
      const splitterAddr = await riskControl.splitter();
      const result = await oracle.lastRound();
      const rewardsAmount = (result[1]).mul(await riskControl.sold());
      for (let i = 1; i <= deliverTimer; i++) {
        await setBlockTimestamp(startAt + 24 * 3600 * i);
        expect(await riskControl.currentStage()).to.equal(ACTIVE);
        await expect(
          riskControl.deliver()
        ).to.emit(riskControl, 'Deliver')
          .withArgs(issuer.address, splitterAddr, rewardsAmount);
      }

      await setBlockTimestamp(startAt + duration + 3600 * 24 + 1);
      expect(await riskControl.currentStage()).to.equal(DEFAULTED);
      const splitter = await riskControl.splitter();
      expect(await ethers.provider.getBalance(splitter)).to.equal(0);
      const liquidateAmount = await ethers.provider.getBalance(riskControl.address);
      await expect(
        riskControl.connect(admin).liquidate()
      ).to.emit(riskControl, 'Liquidate')
        .withArgs(splitter, liquidateAmount);

      const tokenId = 0;
      expect(await hashNFTv2.ownerOf(tokenId)).to.eq(users[tokenId].address);
      const [_, earning] = await oracle.lastRound();
      const amount = earning.mul(hashrates[tokenId]).mul(deliverTimer);
      expect(await riskControl.rewardBalance(hashNFTv2.address, tokenId)).to.eq(amount);
      // const balance = await ethers.provider.getBalance(users[tokenId].address);
      // console.log(balance.toString());
      const tx = await hashNFTv2.connect(users[tokenId]).burn(tokenId);
      await tx.wait();
      const ERC20Contract = await ethers.getContractFactory("MyERC20");
      const wbtc = await ERC20Contract.attach(await riskControl.rewards());
      expect(await wbtc.balanceOf(users[tokenId].address)).to.eq(amount);
      const sum = hashrates.reduce((acc, curr) => acc + curr, 0);
      // const value = liquidateAmount.mul(hashrates[tokenId]).div(sum);
      // console.log(value.toString(), receipt.gasUsed.toString());
      // console.log((await ethers.provider.getBalance(users[tokenId].address)).toString());
      // expect(await ethers.provider.getBalance(users[tokenId].address)).to.eq(balance.add(value).add(receipt.gasUsed));
      await expect(
        hashNFTv2.ownerOf(tokenId)
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it("revert only owner", async function () {
      await mockDeliver();

      const tokenId = 0;
      await expect(
        hashNFTv2.connect(issuer).burn(tokenId)
      ).to.be.revertedWith('HashNFTv2: only owner');
    });

    it("revert tokenId has been approved", async function () {
      await mockDeliver();

      const tokenId = 0;
      const signer = users[tokenId];
      expect(await hashNFTv2.ownerOf(tokenId)).to.eq(signer.address);
      await hashNFTv2.connect(signer).approve( notAdmin.address, tokenId);
      expect(await hashNFTv2.getApproved(tokenId)).to.eq(notAdmin.address);
      await expect(
        hashNFTv2.connect(signer).burn(tokenId)
      ).to.be.revertedWith('HashNFTv2: tokenId has been approved');

      await hashNFTv2.connect(signer).approve( ethers.constants.AddressZero, tokenId);
      await hashNFTv2.connect(signer).burn(tokenId);
      await expect(
        hashNFTv2.ownerOf(tokenId)
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

  });

  // Add any additional describe blocks and test cases as needed
});
