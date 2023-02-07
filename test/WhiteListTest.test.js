// test/WhiteListTest.test.js
// Load dependencies
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { MerkleTree } = require("merkletreejs")

// Start test
describe('WhiteListTest', function () {
  let whitelist
  let merkleTree
  let user1, user2
  let addresses = ["0x1406aF0f2e7C80A04962A85FaE8bB17F89c2B606", "0x8f8BBaef28Ce761491739E098ebd5823c331b0f7", "0x73c8495deD92858bD369f6732dA15ad07E060592", "0xaa6De3f0F61Ee38dddA17A318f670BE624506ACe", "0x5e3Ad07C1605c4CC2d1f9503391D8d54502FDA75", "0xc4C806F427Bfb3936a491dF6a60567Eb533aE89A", "0xd27E703483163e003E0A2DdEB29E7ea9b698923F", "0x6e3B13756fF7E85453f14E020887575F9814C38b", "0x837AE41134fC1ad23e278762Ac2Fac0Fb507567b", "0xb6ac65b5abfc737DB4Dc2c3e90b086FFEB700745", "0xc82e4F40f25e6Db4087c9b9a411DF8Ca5a96cDa9", "0xD4Be51af00044F273efE6616E6389338254b13a3", "0xeE2dac56D96F44Adf0515a8d3c88f4B64FC7321e", "0x2568D8FA520a0887D114CA9c99b8d205Cf61dBf6", "0x328b4fd30C4FaaDa2Ae10C750c75C5f04D2C8293", "0xBE830B967C6a13675cb24b35401564190b882D0E", "0xB1fcF46116022E401704Ad901bB52b486272f869", "0x1EE9ea5F314DedE44455650Ee56dAa42f1091A32", "0x8F05C04370aE2C7765A60390d21Bb10DF7603285", "0x74060EA11b7d820Dd54e8356bA8969b33F33B121", "0x29BEDc56E1CbF3ebbF8763C31f1814fF36a58ed4", "0x89b36C6058ec97496419BeAEC862d5B243b34c80", "0x3060A94E27b6f7A1Abe0dE2CbC90FFEc0b8D51a3", "0x425ce127A38Fb8D3De973d8aF8a5DCb4044adde1", "0x944FcBd00fd984c81eF0aDe6034Eaa56C8ff7011", "0x82466eF300915eBF2c7264a48595fEcB6c1d086e", "0xa344cD5aAa6A62666A3E6427C1Fbd659B2A98629", "0x9E3F108652D9CfC547A538A7360C6F8af44B1f14", "0xCF6Caa2A5e33671378e4B9a522EaB44C5150216c", "0xe63E1eF8aC9A6889d7bC777CAd9e622bFDEA3357", "0xd57c23A6983B837AFEec3396De229AAE74593A00", "0xba7C6fA3cE3322B0F351aDFed383c78f71F62265", "0x59C24cA581264Cc3A34247175C20bbCE118fA4A1", "0x7befeC1fAd1915b57B21Bd26eb90f3922cCCB5b7", "0x04d2c0C362Bbd7eED1CB71d4D61eCB767d9C5754", "0x3d695a9c6518a77D85Cab26742343ADC2bB4e17F", "0x89AC17FeC0374a9efe37614D27383d36A96a29AA", "0xB927139BC0634d0Af84454C93566284cBFaD155C", "0x5868BAf683Ac3Db19ba47b1Aa27A7a44286dD170", "0x649Fc6a5e60E2Bc44FB038Ce4b284E7436097D19", "0xB2F70576e907ed8892b52aF24ECa31157114351C", "0xE3f9DAD7298DF532eEdCb525f79a49c5Ab6fE422", "0x7270ea07c20A0197a0e6b1e81A8AA07A8b536eA0", "0x28c32860e6a56dF324dEdE06166A2a1464bB68D3", "0x87e05d3378179B7ca01E1766f52F8EEbD23C3Aa7", "0x179fE8d7AE8A712365A101223dbc5c03f33Da4Ba", "0xB2A5e5E8E5C8124025de45894F354fe3B517C131", "0xaDD204ba9Ac05AfF1749C5a5377Eea927b0efdE8", "0x61a215bAF454dD3BCEfFD2a3A2FED13Aea85AA23", "0xFcD804AF34373A4A8A7cDa36BF7eEc9a4cF4FB2f"]
  
  beforeEach(async function () {
    // Hash addresses to get the leaves
    [user1, user2] = await ethers.getSigners()
    addresses.push(user2.address)
    let leaves = addresses.map(addr => ethers.utils.keccak256(addr))
    merkleTree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true })
    let rootHash = merkleTree.getRoot()

    const WhiteListTestContract = await ethers.getContractFactory("WhiteListTest")
    whitelist = await WhiteListTestContract.deploy(rootHash)
  })

  describe('verify (bytes32)', function () {
    it('false', async function () {
      let address = user1.address
      let hashedAddress = ethers.utils.keccak256(address)
      let proof = merkleTree.getHexProof(hashedAddress)
      
      expect(await whitelist.connect(user1).verify(proof)).to.equal(false)
    })

    it('true', async function () {
      let address = user2.address
      let hashedAddress = ethers.utils.keccak256(address)
      let proof = merkleTree.getHexProof(hashedAddress)
      
      expect(await whitelist.connect(user2).verify(proof)).to.equal(true)
    })
  })

})