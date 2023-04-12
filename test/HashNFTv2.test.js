// test/HashNFTv2.test.js
// Load dependencies
const { expect } = require('chai')
const { BigNumber } = require('ethers')

const zeroAddress = "0x" + "0".repeat(40)

describe('HashNFTv2', function () {
  let root, to
  let hashnftv2
  const startAt = "05/01/2023"

  beforeEach(async function () {
    [root, to] = await ethers.getSigners()
    const NFTSVGLibrary = await ethers.getContractFactory('NFTSVG')
    nftsvg = await NFTSVGLibrary.deploy()
    await nftsvg.deployed()
    const HashNFTv2Contract = await ethers.getContractFactory('HashNFTv2', { libraries: { NFTSVG: nftsvg.address } })
    hashnftv2 = await HashNFTv2Contract.deploy(startAt)
    await hashnftv2.deployed()
  })

  describe('mint ()', function () {
    it('success', async function () {
      let tokenId = 0
      await expect(
        hashnftv2.mint(to.address)
      ).to.emit(hashnftv2, 'Transfer').withArgs(zeroAddress, to.address, tokenId)

      let metadata = await hashnftv2.tokenURI(tokenId)
      const deocdeMetadata = deocedApplicationBase64(metadata)
      if (deocdeMetadata!="") {
        const jsonObject = JSON.parse(deocdeMetadata)
        const imageData = deocedApplicationBase64(jsonObject.image)
        const fs = require('fs')
        fs.writeFile('test.svg', imageData, 'utf8', (err) => {
          if (err) {
            console.error('An error occurred while writing the file:', err)
          } else {
            console.log('File saved successfully!')
          }
        })
      } else {
        console.log("No match found")
      }
    })
  })
})  

function deocedApplicationBase64(context) {
  const regex = /base64,(.*)/
  const matches = context.match(regex)
  if (matches && matches.length > 1) {
    const base64String = matches[1]
    const buf = Buffer.from(base64String, 'base64')
    return buf.toString()
  }
}