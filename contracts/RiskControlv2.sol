// contracts/RiskControlv2.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IRiskControlv2.sol";
import "./interfaces/IEarningsOracle.sol";
import "./PaymentSplitter.sol";

contract RiskControlv2 is AccessControl, IRiskControlv2 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event IssuerHasChanged(address old, address issuer);

    event Deliver(address from, address to, uint256 amount);

    event Liquidate(address liquidator, uint256 balance);

    enum Status {
        INACTIVE,
        ACTIVE,
        MATURED,
        DEFAULTED
    }

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    IERC20 public immutable rewards;

    PaymentSplitter public immutable splitter;

    IEarningsOracle public immutable earningsOracle;

    uint256 public override price;

    uint256 public override supply;

    uint256 public immutable initialPaymentRatio;

    uint256 public immutable startTime;

    uint256 public immutable duration;

    address public issuer;

    uint256 public override sold = 0;

    uint256 public initialPaymentClaimed = 0;

    mapping(uint256 => uint256) public deliverRecords;

    /**
     * @dev Constructor for the contract.
     * @param rewards_ The address of the rewards contract.
     * @param issuer_ The address of the issuer.
     * @param price_ The price of the hashrate.
     * @param supply_ The total supply of tokens.
     * @param startTime_ The start time of the contract.
     * @param duration_ The duration of the contract.
     * @param initialPaymentRatio_ The initial payment ratio.
     * @param eo The address of the earnings oracle.
     */
    constructor(
        address rewards_,
        address issuer_,
        uint256 price_,
        uint256 supply_,
        uint256 startTime_,
        uint256 duration_,
        uint256 initialPaymentRatio_,
        address eo
    ) {
        rewards = IERC20(rewards_);
        issuer = issuer_;
        price = price_;
        supply = supply_;
        startTime = startTime_;
        duration = duration_;
        initialPaymentRatio = initialPaymentRatio_;
        earningsOracle = IEarningsOracle(eo);

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ISSUER_ROLE, issuer);

        splitter = new PaymentSplitter();
    }

    /**
     * @dev Modifier to check the current stage of the contract.
     * @param statu The status to be checked against.
     */
    modifier atStage(Status statu) {
        require(currentStage() == statu, "Riskcontrol: not the stage");
        _;
    }

    /**
     * @dev Fallback function to receive Ether.
     */
    receive() external payable {}

    /**
     * @dev Set the issuer address.
     * @param _new The new issuer address.
     */
    function setIssuer(address _new) public onlyRole(DEFAULT_ADMIN_ROLE) {
        address old = issuer;
        _revokeRole(ISSUER_ROLE, old);
        issuer = _new;
        _setupRole(ISSUER_ROLE, issuer);
        emit IssuerHasChanged(old, issuer);
    }

    /**
     * @dev Get the current stage of the contract.
     * @return The current stage of the contract.
     */
    function currentStage() internal view returns (Status) {
        //TODO.. DEFAULTED
        uint256 ts = block.timestamp;
        if (ts < startTime) {
            return Status.INACTIVE;
        } else if (ts <= (startTime + duration)) {
            return Status.ACTIVE;
        }
        return Status.MATURED;
    }

    /**
     * @dev Bind an NFT to the contract.
     * @param amount The amount of tokens to bind.
     * @param nft The address of the NFT contract.
     * @param tokenId The ID of the token.
     */
    function bind(
        address nft,
        uint256 tokenId,
        uint256 amount
    ) public payable override atStage(Status.INACTIVE) {
        require(
            sold.add(amount) <= supply,
            "Riskcontrol: insufficient hashrates"
        );
        require(
            price.mul(amount) <= msg.value,
            "Riskcontrol: insufficient ether"
        );

        sold = sold.add(amount);
        splitter.addPayee(nft, tokenId, amount);
    }

    function mintAllowed() public view override returns (bool) {
        return currentStage() == Status.INACTIVE;
    }

    function hashrate(
        address nft,
        uint256 tokenId
    ) public view override returns (uint256) {
        return splitter.shares(nft, tokenId);
    }

    function rewardBalance(
        address nft,
        uint256 tokenId
    ) public view override returns (uint256) {
        return
            splitter.totalReleased(rewards).div(splitter.totalShares()).mul(
                splitter.shares(nft, tokenId)
            );
    }

    function release(IERC20 token, address nft, uint256 tokenId) public {
        require(
            currentStage() == Status.MATURED || currentStage() == Status.DEFAULTED,
            "RiskControl: statu not in MATURED or DEFAULTED"
        );
        splitter.release(token, nft, tokenId);
    }

    function release(address nft, uint256 tokenId) public {
        require(
            currentStage() == Status.MATURED || currentStage() == Status.DEFAULTED,
            "RiskControl: statu not in MATURED or DEFAULTED"
        );
        splitter.release(nft, tokenId);
    }

    /**
     * @dev Claim the initial payment.
     */
    function claimInitialPayment()
        public
        onlyRole(ISSUER_ROLE)
        atStage(Status.ACTIVE)
    {
        require(
            initialPaymentClaimed == 0,
            "RiskControl: initialPayment already claimed"
        );
        uint256 amount = address(this).balance;
        amount = amount.div(10000).mul(initialPaymentRatio);
        address payable recipientPayable = payable(issuer);
        recipientPayable.transfer(amount);
        initialPaymentClaimed = amount;
    }

    /**
     * @dev Withdraw the funds from the contract.
     */
    function withdraw() public onlyRole(ISSUER_ROLE) atStage(Status.MATURED) {
        require(
            initialPaymentClaimed > 0,
            "RiskControl: initial payment not claimed"
        );
        uint256 amount = address(this).balance;
        address payable recipientPayable = payable(issuer);
        recipientPayable.transfer(amount);
    }

    /**
     * @dev Deliver the tokens to the contract.
     */
    function deliver() public atStage(Status.ACTIVE) {
        uint256 deliverDesDay = block.timestamp.sub(startTime).div(1 days) - 1;
        require(
            deliverRecords[deliverDesDay] == 0,
            "RiskControl: already deliver"
        );
        uint256 earnings = earningsOracle.getRound(deliverDesDay);
        if (earnings == 0) {
            (, uint256 lastEarnings) = earningsOracle.lastRound();
            earnings = lastEarnings;
        }
        require(earnings > 0, "RiskControl: error daily earning");

        uint256 amount = earnings.mul(sold);
        deliverRecords[deliverDesDay] = amount;

        rewards.safeTransferFrom(issuer, address(splitter), amount);
        emit Deliver(address(issuer), address(splitter), amount);
    }

    /**
     * @dev Liquidate the contract.
     */
    function liquidate()
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
        atStage(Status.ACTIVE)
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "RiskControl: no funds need liquidate");
        uint256 desDay = block.timestamp.sub(startTime).div(1 days) - 1 - 1;
        require(
            deliverRecords[desDay] == 0,
            "RiskControl: liquidate conditions are not met"
        );
        address payable recipientPayable = payable(address(splitter));
        recipientPayable.transfer(balance);
        emit Liquidate(address(splitter), balance);
    }
}
