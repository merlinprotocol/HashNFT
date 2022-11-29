// contracts/HashNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/IEarningsOracle.sol";
import "./interfaces/IRiskControl.sol";
import "./mToken.sol";
import "./ERC4907a.sol";

enum NftType {
    IRON,
    SILVER,
    GOLD
}

contract HashNFT is ERC4907a {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    event HashNFTMint(
        address indexed payer,
        address indexed to,
        uint256 tokenId,
        uint256 hashrate,
        string note
    );
    event IssuerHasChanged(address from, address to);
    event Deliver(uint256 day, uint256 amount);

    IERC20 public immutable payment;

    IRiskControl public riskControl;

    uint256 public immutable total;

    IEarningsOracle public immutable oracle;

    uint256 public sold;

    mToken public mtoken;

    Counters.Counter private _counter;

    string private _defaultURI;

    string private _bURI;

    address private _issuer;

    mapping(uint256 => NftType) public nftHashTypes;

    constructor(
        uint256 total_,
        address payment_,
        address rewards,
        address issuer_,
        address risk,
        address oracle_
    )
        ERC4907a("Hash NFT", "HASHNFT")
    {
        payment = IERC20(payment_);
        oracle = IEarningsOracle(oracle_);
        riskControl = IRiskControl(risk);
        total = total_;

        sold = 0;
        _defaultURI = "https://gateway.pinata.cloud/ipfs/QmeXA6bFsvAZspDvQTAiGZ7xdCyKPjKcFVzFRmaZQF7acb";

        mtoken = new mToken(rewards);
        _issuer = issuer_;
    }

    modifier onlyIssuer() {
        require(msg.sender == _issuer, "HashNFT: msg not from issuer");
        _;
    }

    function mint(address _to, NftType _nftType, string memory note) public returns (uint256) 
    {
        uint256 _hashrate = hashRateOf(_nftType);
        require(_to != address(0), "HashNFT: mint to the zero address");
        require(sold + _hashrate <= total, "HashNFT: insufficient hashrates");
        require(riskControl.mintAllowed(),  "HashNFT: risk not allowed to mint");

        uint256 cost = riskControl.price() * _hashrate;
        payment.transferFrom(msg.sender, address(riskControl), cost);

        uint256 tokenId = _counter.current();

        _safeMint(_to, tokenId);
        _counter.increment();

        nftHashTypes[tokenId] = _nftType;
        mtoken.addPayee(address(this), tokenId, _hashrate);
        sold = sold.add(_hashrate);

        emit HashNFTMint(msg.sender, _to, tokenId, _hashrate, note);
        return tokenId;
    }

    function liquidate() external {
        address mt = _createmToken();
        riskControl.liquidate(msg.sender, mt);
    }

    function tokenHashRate(uint256 tokenId) public view returns(uint256) {
        require(_exists(tokenId), "!exist");
        return hashRateOf(nftHashTypes[tokenId]);
    }

    function hashRateOf(NftType nftType) public pure returns(uint256) {
        if (nftType == NftType.IRON) {
            return 1;
        } else if (nftType == NftType.SILVER) {
            return 5;
        } else if (nftType == NftType.GOLD) {
            return 15;
        }
        revert("!nft type");
    }

    function _createmToken() internal returns(address) {
        mToken mt = new mToken(address(payment));
        for (uint32 i=0;i<_counter.current();++i) {
            mt.addPayee(address(this), i, hashRateOf(nftHashTypes[i]));
        }
        return address(mt);
    }

    /**
     * @dev Delivery of hash power mining proceeds
     *
     * Requirements:
     *
     *
     * emit a {Deliver} event.
     */
    function deliver()
        external
        onlyIssuer
    {
        require(riskControl.deliverAllowed(),  "HashNFT: risk not allowed to deliver");
        (uint256 round, uint256 amount) = oracle.lastRound();
        require(round != 0, "!round");
        amount = sold.mul(amount);
        require(amount > 0, "zero deliver");
        // TODO... add online coefficient
        IERC20 funds = mtoken.funds();
        funds.transferFrom(msg.sender, address(mtoken), amount);

        uint256 desDay = riskControl.dayNow() - 1;
        riskControl.deliver(desDay, amount);
        emit Deliver(desDay, amount);
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
        string memory _tokenURI = super.tokenURI(tokenId);
        if (bytes(_tokenURI).length > 0) {
            return _tokenURI;
        }
        return _defaultURI;
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        _bURI = baseURI;
    }

    /**
     * @dev See {ERC721-_baseURI}
     */
    function _baseURI() internal view override returns (string memory) {
        return _bURI;
    }

    /**
     * @dev Set a new issuer address.
     *
     * Requirements:
     *
     * - `new_` cannot be the zero address.
     * - the caller must be the issuer.
     *
     * Emits a {ChangeIssuer} event.
     */
    function setIssuer(address new_) external onlyIssuer {
        address old = _issuer;
        _issuer = new_;
        emit IssuerHasChanged(old, new_);
    }
}
