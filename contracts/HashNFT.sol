// contracts/HashNFT.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/IEarningsOracle.sol";
import "./interfaces/IRiskControl.sol";
import "./interfaces/IHashNFT.sol";
import "./mToken.sol";
import "./ERC4907a.sol";

contract HashNFT is IHashNFT, ERC4907a { 
    enum Trait {
        BASIC,
        STANDARD,
        PREMIUM
    }
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    event HashNFTMint(
        address indexed to,
        uint256 tokenId,
        Trait trait,
        string note
    );

    IRiskControl public immutable riskControl;

    address public immutable vault; 

    uint256 public immutable totalSupply;

    mToken public immutable mtoken;

    bytes32 public immutable whiteListRootHash;

    uint8 public immutable whiteListMintLimit;

    bytes32 public immutable nodesRootHash;

    uint8 public immutable nodeMintLimit;

    uint256 public immutable whiteListEndtime;

    mapping(address => uint8) public whiteListMint;

    mapping(address => uint8) public nodeMint;

    Counters.Counter private _counter;

    string private constant _defaultURI = "https://gateway.pinata.cloud/ipfs/QmeXA6bFsvAZspDvQTAiGZ7xdCyKPjKcFVzFRmaZQF7acb";

    mapping(uint256 => string) private _tokenURIs;

    mapping(Trait => uint256) public traitHashrates;

    mapping(Trait => uint256) public traitPrices;

    mapping(uint256 => Trait) public traits;

    mapping(Trait => uint256) public traitBalance;

    constructor(
        address rewards,
        address risk,
        uint256[] memory prices,
        address _vault,
        uint256 _whiteListEndtime,
        bytes32 _whiteListRootHash,
        uint8 _whiteListMintLimit,
        bytes32 _nodesRootHash,
        uint8 _nodeMintLimit
    ) ERC4907a("Hash NFT", "HASHNFT") {
        riskControl = IRiskControl(risk);
        require(prices.length == 9, "HashNFT: prices array length error");
        require((block.timestamp + 1 days) < _whiteListEndtime, "HashNFT: invalid whitelist end time");
        //BASIC
        uint256 hashrate = prices[0];
        uint256 price = prices[1];
        uint256 balance = prices[2];
        require(price >= riskControl.price().mul(hashrate), "HashNFT: trait BASIC price error");
        traitHashrates[Trait.BASIC] = hashrate;
        traitPrices[Trait.BASIC] = price;
        traitBalance[Trait.BASIC] = balance;
        
        uint256 ts = hashrate.mul(balance);

        //STANDARD
        hashrate = prices[3];
        price = prices[4];
        balance = prices[5];
        require(price >= riskControl.price().mul(hashrate), "HashNFT: trait STANDARD price error");
        traitHashrates[Trait.STANDARD] = hashrate;
        traitPrices[Trait.STANDARD] = price;
        traitBalance[Trait.STANDARD] = balance;
        ts = ts.add(hashrate.mul(balance));

        //PREMIUM
        hashrate = prices[6];
        price = prices[7];
        balance = prices[8];
        require(price >= riskControl.price().mul(hashrate), "HashNFT: trait PREMIUM price error");
        traitHashrates[Trait.PREMIUM] = hashrate;
        traitPrices[Trait.PREMIUM] = price;
        traitBalance[Trait.PREMIUM] = balance;
        totalSupply = ts.add(hashrate.mul(balance));
        
        vault = _vault;
        whiteListRootHash = _whiteListRootHash;
        whiteListMintLimit = _whiteListMintLimit;
        nodesRootHash = _nodesRootHash;
        nodeMintLimit = _nodeMintLimit;
        whiteListEndtime = _whiteListEndtime;
        mtoken = new mToken(rewards);
    }

    function sold() external view override returns(uint256) {
        uint256 balance = totalSupply;
        balance = balance.sub(traitHashrates[Trait.BASIC].mul(traitBalance[Trait.BASIC]));
        balance = balance.sub(traitHashrates[Trait.STANDARD].mul(traitBalance[Trait.STANDARD]));
        return balance.sub(traitHashrates[Trait.PREMIUM].mul(traitBalance[Trait.PREMIUM]));
    }

    function dispatcher() external view override returns (address) {
        return address(mtoken);
    }

    function payForMint(
        bytes32[] calldata _proof,
        Trait _nftType,
        string memory _note
    ) public returns (uint256) {
        uint256 balance = traitBalance[_nftType];
        require(balance > 0, "HashNFT: insufficient hashrates");
        require(riskControl.mintAllowed(), "HashNFT: risk not allowed to mint");
        address to = msg.sender;
        if (block.timestamp < whiteListEndtime) {
            bytes32 leaf = keccak256(abi.encodePacked(to));
            if (MerkleProof.verify(_proof, nodesRootHash, leaf)) { // node
                require(nodeMint[to] < nodeMintLimit, "HashNFT: insufficient whitelist of node");
                nodeMint[to] = nodeMint[to] + 1;
            } else if (MerkleProof.verify(_proof, whiteListRootHash, leaf)) {  // whitelist
                require(whiteListMint[to] < whiteListMintLimit, "HashNFT: insufficient whitelist");
                whiteListMint[to] = whiteListMint[to] + 1;
            } else {
                revert("HashNFT: not in whitelist");
            }
        }

        uint256 hashrate = traitHashrates[_nftType];
        uint256 amount = traitPrices[_nftType];
        uint256 cost = riskControl.price().mul(hashrate);
        riskControl.funds().safeTransferFrom(msg.sender, address(riskControl), cost);
        riskControl.funds().safeTransferFrom(msg.sender, vault, amount.sub(cost));

        uint256 tokenId = _counter.current();

        _safeMint(to, tokenId);
        _counter.increment();
        _setTokenURI(tokenId, _defaultURI);

        mtoken.addPayee(tokenId, hashrate);

        traitBalance[_nftType] = balance.sub(1);
        traits[tokenId] = _nftType;
        emit HashNFTMint(to, tokenId, _nftType, _note);
        return tokenId;
    }

    function hashRateOf(uint256 tokenId) public view returns (uint256) {
        require(_exists(tokenId), "HashNFT: tokenId not exist");
        return traitHashrates[traits[tokenId]];
    }

     /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI query for nonexistent token"
        );

        string memory _tokenURI = _tokenURIs[tokenId];
        return _tokenURI;
    }

    function updateURI(uint256 tokenId, string memory tokenURI_)
        public
        onlyOwner
    {
        require(
            keccak256(abi.encodePacked(tokenURI(tokenId))) ==
                keccak256(abi.encodePacked(_defaultURI)),
            "HashNFT: token URI already updated"
        );
        _setTokenURI(tokenId, tokenURI_);
    }

    /**
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _setTokenURI(uint256 tokenId, string memory tokenURI_)
        internal
        virtual
    {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI set of nonexistent token"
        );
        _tokenURIs[tokenId] = tokenURI_;
    }
}
