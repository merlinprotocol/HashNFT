const { ethers } = require('hardhat')
const MerkleTree = require('merkletreejs').MerkleTree
const SHA256 = require('crypto-js/sha256')

async function func() {
  const { deployments } = hre
  const [deployer] = await ethers.getSigners()
  console.log('deployer', deployer.address)

  let leaves = ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"]
  const hashFunc = x => SHA256(x)
  const tree = new MerkleTree(leaves, hashFunc)
  const rootHash = tree.getRoot()

  await deployments.deploy('NFTSVG', {
      from: deployer.address,
      contract: 'NFTSVG',
      log: true
  })
  const nftsvg = await ethers.getContract('NFTSVG')
  const startAt = "04/01/2023"
  await deployments.deploy('HashNFTv2', {
    from: deployer.address,
    contract: 'HashNFTv2',
    log: true,
    libraries: { NFTSVG: nftsvg.address },
    args: [startAt],
  })

  const hashnftv2 = await ethers.getContract('HashNFTv2') 
  await hashnftv2.setWhiteListRootHash(rootHash)
  await hashnftv2.setFreeMintSupply(200)
  await hashnftv2.setWhitelistLimit(1)
}

module.exports = func

func.tags = ['02']