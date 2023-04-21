// contracts/HashNFTv2.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/IRiskControlv2.sol";
import "./libraries//NFTSVG.sol";
import "hardhat/console.sol";

contract HashNFTv2 is ERC721, AccessControl {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    event Withdraw(address to, uint256 balance);

    Counters.Counter private _counter;

    uint8 public freeMintSupply;

    uint8 public freeMinted = 0;

    bytes32 public whiteListRootHash;

    uint public whitelistLimit;

    IRiskControlv2 public riskControl;

    mapping(address => uint8) public whitelistMinted;

    constructor(address rs) ERC721("Hash NFT v2", "HASHNFTv2") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        riskControl = IRiskControlv2(rs);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Fallback function to receive Ether.
     */
    receive() external payable {}

    function setWhiteListRootHash(
        bytes32 whiteListRootHash_
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whiteListRootHash = whiteListRootHash_;
    }

    function setFreeMintSupply(
        uint8 supply
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        freeMintSupply = supply;
    }

    function setWhitelistLimit(
        uint8 limit
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistLimit = limit;
    }

    function freeMint(
        bytes32[] calldata _proof,
        address to
    ) public returns (uint256) {
        require(to != address(0), "HashNFTv2: zero address");
        require(riskControl.mintAllowed(), "HashNFTv2: mint not allow");
        require(
            freeMinted < freeMintSupply && whitelistMinted[to] < whitelistLimit,
            "HashNFTv2: insufficient whitelist"
        );
        bytes32 leaf = keccak256(abi.encodePacked(to));
        require(
            MerkleProof.verify(_proof, whiteListRootHash, leaf),
            "HashNFTv2: caller is not in whitelist"
        );
        uint256 balance = address(this).balance;
        require(balance >= riskControl.price(), "HashNFTv2: insufficient funds");

        uint256 tokenId = _counter.current();
        _safeMint(to, tokenId);
        _counter.increment();
        whitelistMinted[to] = whitelistMinted[to] + 1;
        freeMinted += 1;
        riskControl.bind{value:riskControl.price()}(address(this), tokenId, 1);
        return tokenId;
    }

    function mint(uint256 amount, address to) public payable returns (uint256) {
        require(to != address(0), "HashNFTv2: zero address");
        require(riskControl.mintAllowed(), "HashNFTv2: mint not allow");
        require(
            amount.add(riskControl.sold()) <= riskControl.supply(),
            "HashNFTv2: insufficient hashrate"
        );
        uint256 balance = amount.mul(riskControl.price());
        require(balance >= msg.value, "HashNFTv2: insufficient funds");

        uint256 tokenId = _counter.current();
        _safeMint(to, tokenId);
        _counter.increment();
        riskControl.bind{value:balance}(address(this), tokenId, amount);
        return tokenId;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory metadata) {
        require(_exists(tokenId), "HashNFTv2: URI query for nonexistent token");
        NFTSVG.SVGParams memory svgParams = NFTSVG.SVGParams({
            owner: ownerOf(tokenId),
            tokenId: tokenId,
            hashrate: riskControl.hashrate(address(this), tokenId),
            rewards: riskControl.rewardBalance(address(this), tokenId),
            startTime: ""
        });
        metadata = NFTSVG.generateMetadata(svgParams);
    }

    function withdraw() public onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "HashNFTv2: no funds");
        address payable recipientPayable = payable(msg.sender);
        recipientPayable.transfer(balance);
        emit Withdraw(recipientPayable, balance);
    }
}
