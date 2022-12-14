// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "double-contracts/contracts/4907/ERC4907.sol";


contract mToken is Context, Ownable {
    event FundsClaimed(IERC20 indexed token, address to, uint256 amount);
    event PayeeAdded(address nft, uint256 tokenId, uint256 shares);

    IERC20 public funds;
    address public nft;

    uint256 private _totalShares;
    uint256 private _fundsTotalClaimed;
    mapping(uint256 => uint256) private _fundsClaimed;

    mapping(uint256 => uint256) private _shares;
    uint256[] private _payees;

    /**
     * @dev Creates an instance of `mToken`
     */
    constructor(address funds_, address nft_) {
        funds = IERC20(funds_);
        nft = nft_;
    }

    receive() external payable {
        revert("!ether");
    }

    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    function totalClaimed() public view returns (uint256) {
        return _fundsTotalClaimed;
    }

    function addPayee(uint256 tokenId, uint256 shares_) public onlyOwner {
        require(
            IERC721(nft).ownerOf(tokenId) != address(0),
            "mToken: account is the zero address"
        );
        require(shares_ > 0, "mToken: shares are 0");

        _payees.push(tokenId);
        _shares[tokenId] += shares_;
        _totalShares = _totalShares + shares_;
        emit PayeeAdded(nft, tokenId, shares_);
    }

    function shares(uint256 tokenId)
        public
        view
        returns (uint256)
    {
        return _shares[tokenId];
    }

    function claimed(uint256 tokenId)
        public
        view
        returns (uint256)
    {
        return _fundsClaimed[tokenId];
    }

    function payee(uint256 index) public view returns (address, uint256) {
        return (nft, _payees[index]);
    }

    function claims(uint256 tokenId) public {
        address account = IERC4907(nft).userOf(tokenId);
        require(account == msg.sender, "mToken: caller is not the nft's owner");
        require(
            _shares[tokenId] > 0,
            "mToken: tokenId has no shares"
        );
        uint256 totalReceived = funds.balanceOf(address(this)) +
            _fundsTotalClaimed;
        uint256 payment = _pending(
            tokenId,
            totalReceived,
            claimed(tokenId)
        );

        require(payment != 0, "mToken: tokenId is not due payment");
        _fundsClaimed[tokenId] += payment;
        _fundsTotalClaimed += payment;
        SafeERC20.safeTransfer(funds, account, payment);
        emit FundsClaimed(funds, account, payment);
    }

    function _pending(
        uint256 tokenId,
        uint256 totalReceived,
        uint256 alreadyClaimed
    ) private view returns (uint256) {
        return
            (totalReceived * _shares[tokenId]) /
            _totalShares -
            alreadyClaimed;
    }

}
