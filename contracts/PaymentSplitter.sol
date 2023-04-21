// contracts/HashNFTv2.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./libraries/utils.sol";

/**
 * @title PaymentSplitter
 * @dev This contract allows to split payments among a group of payees, identified by their NFTs and token IDs.
 */
contract PaymentSplitter is Context, AccessControl {
    struct NFTInfo {
        address nft;
        uint256 tokenId;
    }
    event PayeeAdded(address nft, uint256 tokenId, uint256 shares);
    event PaymentReleased(address to, uint256 amount);
    event ERC20PaymentReleased(
        IERC20 indexed token,
        address to,
        uint256 amount
    );
    event PaymentReceived(address from, uint256 amount);

    uint256 private _totalShares;
    uint256 private _totalReleased;

    mapping(string => uint256) private _shares;
    mapping(string => uint256) private _released;
    NFTInfo[] private _payees;

    mapping(IERC20 => uint256) private _erc20TotalReleased;
    mapping(IERC20 => mapping(string => uint256)) private _erc20Released;

    /**
     * @dev Constructor.
     * Grants admin role to the deployer of the contract.
     */
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Fallback function to receive Ether.
     */
    receive() external payable virtual {
        emit PaymentReceived(_msgSender(), msg.value);
    }

    /**
     * @dev Add a new payee to the contract.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     * @param shares_ The number of shares allocated to the payee.
     */
    function addPayee(
        address nft,
        uint256 tokenId,
        uint256 shares_
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            IERC721(nft).ownerOf(tokenId) != address(0),
            "mToken: account is the zero address"
        );
        require(shares_ > 0, "mToken: shares are 0");

        _payees.push(NFTInfo(nft, tokenId));
        _shares[_toString(nft, tokenId)] += shares_;
        _totalShares = _totalShares + shares_;
        emit PayeeAdded(nft, tokenId, shares_);
    }

    /**
     * @dev Get the total number of shares.
     * @return The total number of shares.
     */
    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    /**
     * @dev Get the total amount of Ether released.
     * @return The total amount of Ether released.
     */
    function totalReleased() public view returns (uint256) {
        return _totalReleased;
    }

     /**
     * @dev Get the total amount of tokens released.
     * @param token The ERC20 token for which to query the total released amount.
     * @return The total amount of tokens released.
     */
    function totalReleased(IERC20 token) public view returns (uint256) {
        return _erc20TotalReleased[token];
    }

    /**
     * @dev Get the number of shares for a specific NFT token.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     * @return The number of shares for the specified NFT token.
     */
    function shares(
        address nft,
        uint256 tokenId
    ) public view returns (uint256) {
        return _shares[_toString(nft, tokenId)];
    }


    /**
     * @dev Get the total amount of Ether released for a specific NFT token.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     * @return The total amount of Ether released for the specified NFT token.
     */
    function released(
        address nft,
        uint256 tokenId
    ) public view returns (uint256) {
        return _released[_toString(nft, tokenId)];
    }

    /**
     * @dev Get the total amount of tokens released for a specific NFT token.
     * @param token The ERC20 token for which to query the released amount.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     * @return The total amount of tokens released for the specified NFT token.
     */
    function released(
        IERC20 token,
        address nft,
        uint256 tokenId
    ) public view returns (uint256) {
        return _erc20Released[token][_toString(nft, tokenId)];
    }

    /**
     * @dev Get the payee information at a specific index.
     * @param index The index of the payee.
     * @return The address and tokenId of the payee at the specified index.
     */
    function payee(uint256 index) public view returns (address, uint256) {
        return (_payees[index].nft, _payees[index].tokenId);
    }

    /**
     * @dev Release the Ether for a specific NFT token.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     */
    function release(address nft, uint256 tokenId) public onlyRole(DEFAULT_ADMIN_ROLE) virtual {
        require(
            _shares[_toString(nft, tokenId)] > 0,
            "PaymentSplitter: account has no shares"
        );

        uint256 totalReceived = address(this).balance + totalReleased();
        uint256 payment = _pendingPayment(
            nft,
            tokenId,
            totalReceived,
            released(nft, tokenId)
        );

        require(payment != 0, "PaymentSplitter: account is not due payment");

        _released[_toString(nft, tokenId)] += payment;
        _totalReleased += payment;
        address payable to = payable(IERC721(nft).ownerOf(tokenId));
        Address.sendValue(to, payment);
        emit PaymentReleased(to, payment);
    }

    /**
     * @dev Release the tokens for a specific NFT token.
     * @param token The ERC20 token to be released.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     */
    function release(
        IERC20 token,
        address nft,
        uint256 tokenId
    ) public onlyRole(DEFAULT_ADMIN_ROLE) virtual {
        require(
            _shares[_toString(nft, tokenId)] > 0,
            "PaymentSplitter: account has no shares"
        );

        uint256 totalReceived = token.balanceOf(address(this)) +
            totalReleased(token);
        uint256 payment = _pendingPayment(
            nft,
            tokenId,
            totalReceived,
            released(token, nft, tokenId)
        );

        require(payment != 0, "PaymentSplitter: account is not due payment");

        _erc20Released[token][_toString(nft, tokenId)] += payment;
        _erc20TotalReleased[token] += payment;
        address to = IERC721(nft).ownerOf(tokenId);
        SafeERC20.safeTransfer(token, to, payment);
        emit ERC20PaymentReleased(token, to, payment);
    }

    /**
     * @dev Calculate the pending payment for a specific NFT token.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     * @param totalReceived The total amount of Ether or tokens received by the contract.
     * @param alreadyReleased The total amount of Ether or tokens already released for this NFT token.
     * @return The pending payment amount for the specified NFT token.
     */
    function _pendingPayment(
        address nft,
        uint256 tokenId,
        uint256 totalReceived,
        uint256 alreadyReleased
    ) private view returns (uint256) {
        return
            (totalReceived * _shares[_toString(nft, tokenId)]) /
            _totalShares -
            alreadyReleased;
    }

    /**
     * @dev Convert the NFT address and tokenId to a string representation.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     * @return The string representation of the NFT address and tokenId.
     */
    function _toString(
        address nft,
        uint256 tokenId
    ) private pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    utils.AddressToString(nft),
                    ":",
                    Strings.toString(tokenId)
                )
            );
    }
}
