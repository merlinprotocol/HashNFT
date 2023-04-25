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
  let freeMintUser;
  let user;
  let users;
  let merkleTree;

  let startAt;
  const duration = 3600 * 24 * 30;
  const hashrates = [1000, 500, 1000, 1000];
  const supply = 4000;
  const price = ethers.utils.parseEther("0.001");
  const ratio = 3000;
  const freeMintSupply = 200;
  const whitelistLimit = 2;
  const INACTIVE = 0;
  const ACTIVE = 1;
  const MATURED = 2;
  const DEFAULTED = 3;

  async function freeMint(signer, count) {
    const balance = await ethers.provider.getBalance(hashNFTv2.address);
    if (balance < price) {
      await deployer.sendTransaction({
        to: hashNFTv2.address,
        value: price.mul(freeMintSupply),
      });
    }
    const hashedAddress = ethers.utils.keccak256(signer.address);
    let proof = merkleTree.getHexProof(hashedAddress);

    let tokenId = 0;
    for (let i = 0; i < count; i++) {
      await expect(
        await hashNFTv2.connect(signer).freeMint(proof, signer.address)
      ).to.emit(hashNFTv2, 'Transfer')
        .withArgs(ethers.constants.AddressZero, signer.address, tokenId);
      expect(await hashNFTv2.ownerOf(tokenId)).to.equal(signer.address);
      tokenId += 1;
    }
    expect(await hashNFTv2.freeMinted()).to.equal(count);
    expect(await ethers.provider.getBalance(riskControl.address)).to.equal(price.mul(count));
  }

  async function mint(signer, amounts) {
    let tokenId = 0;
    let sold = 0;
    for (const amount of amounts) {
      const balance = (await riskControl.price()).mul(amount);
      await expect(
        await hashNFTv2.connect(signer).mint(amount, signer.address, { value: balance })
      ).to.emit(hashNFTv2, 'Transfer')
        .withArgs(ethers.constants.AddressZero, signer.address, tokenId);
      expect(await hashNFTv2.ownerOf(tokenId)).to.equal(signer.address);
      tokenId += 1;
      sold += amount;
    }
    expect(await riskControl.sold()).to.equal(sold);
  }

  beforeEach(async function () {
    [deployer, tracker, issuer, freeMintUser, user, user1, user2, user3, user4, notAdmin] = await ethers.getSigners();
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
    await hashNFTv2.setFreeMintSupply(freeMintSupply);
    await hashNFTv2.setWhitelistLimit(whitelistLimit);
    merkleTree = await generateMerkleTree(freeMintUser.address);
    await hashNFTv2.setWhiteListRootHash(merkleTree.getRoot());
  });

  describe("HashNFTv2 deployment", function () {
    it("should deploy with correct parameters", async function () {
      // Add test cases for verifying constructor parameters
      expect(await hashNFTv2.freeMintSupply()).to.equal(freeMintSupply);
      expect(await hashNFTv2.whitelistLimit()).to.equal(whitelistLimit);
      expect(await hashNFTv2.freeMinted()).to.equal(0);
      expect(await hashNFTv2.riskControl()).to.equal(riskControl.address);
      expect(await hashNFTv2.whiteListRootHash()).to.equal(merkleTree.getHexRoot());
      expect(await hashNFTv2.name()).to.equal("Hash NFT v2");
      expect(await hashNFTv2.symbol()).to.equal("HASHNFTv2");

      expect(await riskControl.startTime()).to.equal(startAt);
      expect(await riskControl.mintAllowed()).to.equal(true);
    });
  });

  describe("FreeMint functionality", function () {
    it("should correctly mint tokens for free", async function () {
      // Add test cases for free minting of tokens
      await freeMint(freeMintUser, 1);
    });

    it('revert mint not allow', async function () {
      await setBlockTimestamp(startAt);
      await expect(
        freeMint(freeMintUser, 1)
      ).to.be.revertedWith('HashNFTv2: mint not allow');
    });

    it('revert caller is not in whitelist', async function () {
      await expect(
        freeMint(user, 1)
      ).to.be.revertedWith('HashNFTv2: caller is not in whitelist');
    });

    it('revert insufficient whitelist', async function () {
      await expect(
        freeMint(freeMintUser, 3)
      ).to.be.revertedWith('HashNFTv2: insufficient whitelist');
    });

    it('revert insufficient whitelist 2', async function () {
      await hashNFTv2.setFreeMintSupply(1);
      await expect(
        freeMint(freeMintUser, 2)
      ).to.be.revertedWith('HashNFTv2: insufficient whitelist');
    });

    it('revert insufficient funds', async function () {
      expect(await ethers.provider.getBalance(hashNFTv2.address)).to.equal(0);
      const hashedAddress = ethers.utils.keccak256(freeMintUser.address);
      let proof = merkleTree.getHexProof(hashedAddress);
      await expect(
        hashNFTv2.connect(freeMintUser).freeMint(proof, freeMintUser.address)
      ).to.be.revertedWith('HashNFTv2: insufficient funds');
    });
  });

  describe("Mint functionality", function () {
    it("should correctly mint tokens", async function () {
      // Add test cases for minting tokens
      await mint(user, [10]);
    });

    it('revert mint not allow', async function () {
      await setBlockTimestamp(startAt);
      await expect(
        mint(user, [10])
      ).to.be.revertedWith('HashNFTv2: mint not allow');
    });

    it('revert insufficient hashrate', async function () {
      await expect(
        mint(user, [(await riskControl.supply()), 1])
      ).to.be.revertedWith('HashNFTv2: insufficient hashrate');
    });
  });

  describe("TokenURI functionality", function () {
    it("should return correct tokenURI", async function () {
      // Add test cases for tokenURI functionality
    });
  });

  describe("Withdraw functionality", function () {
    it("should correctly Withdraw", async function () {
      // Add test cases for withdraw functionality
      await freeMint(freeMintUser, 2);
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
        await hashNFTv2.connect(users[i]).mint(hashrates[i], users[i].address, { value: balance });
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
        await hashNFTv2.connect(users[i]).mint(hashrates[i], users[i].address, { value: balance });
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
  });

  // Add any additional describe blocks and test cases as needed
});
