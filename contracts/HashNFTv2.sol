// contracts/HashNFTv2.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./NFTSVG.sol";

contract HashNFTv2 is ERC721 {
    using Counters for Counters.Counter;

    Counters.Counter private _counter;

    string public startAt;

    constructor(string memory startAt_) ERC721("Hash NFT v2", "HASHNFTv2") {
        startAt = startAt_;
    }

    function mint(address to) public returns (uint256) {
        uint256 tokenId = _counter.current();
        _safeMint(to, tokenId);
        _counter.increment();
        return tokenId;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory metadata) {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI query for nonexistent token"
        );
        NFTSVG.SVGParams memory svgParams = NFTSVG.SVGParams({
            owner: ownerOf(tokenId),
            tokenId: tokenId,
            hashrate: 100,
            rewards: 999999,
            startTime: startAt
        });
        metadata = NFTSVG.generateMetadata(svgParams);
    }
}
