// contracts/RiskControlv2.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IRiskControlv2.sol";
import "./interfaces/IEarningsOracle.sol";
import "./PaymentSplitter.sol";

contract RiskControlv2 is AccessControl, IRiskControlv2 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event IssuerHasChanged(address old, address issuer);

    event Deliver(address, address, uint256);

    event Bind(address, uint256, uint256);

    event ClaimInitialPayment(address, uint256);

    event Liquidate(address, uint256);

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    IERC20 public override rewards;

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
        require(currentStage() == statu, "RiskControl: not the stage");
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
    function currentStage() public view override returns (Status) {
        uint256 ts = block.timestamp;
        if (ts < startTime) {
            return Status.INACTIVE;
        }
        if (_deliveryException() == true) {
            return Status.DEFAULTED;
        } else if (ts <= (startTime + duration + 1 days)) {
            return Status.ACTIVE;
        }
        return Status.MATURED;
    }

    function _deliveryException() private view returns (bool) {
        uint256 ts = block.timestamp;
        if (ts <= startTime) {
            return false;
        } else {
            uint256 today = ts.sub(startTime).div(1 days);
            if (today < 2) {
                return false;
            }
            uint256 fin = duration.div(1 days).add(2);
            fin = fin < today ? fin : today;
            for (uint256 i = 0; i < fin - 1; i++) {
                if (deliverRecords[i] == 0) {
                    return true;
                }
            }
        }
        return false;
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
            "RiskControl: insufficient hashrates"
        );
        require(
            price.mul(amount) <= msg.value,
            "RiskControl: insufficient ether"
        );

        sold = sold.add(amount);
        splitter.addPayee(nft, tokenId, amount);
        emit Bind(nft, tokenId, amount);
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
        uint256 totalReceived = rewards.balanceOf(address(splitter)) +
            splitter.totalReleased(rewards);
        return
            totalReceived.mul(splitter.shares(nft, tokenId)).div(
                splitter.totalShares()
            );
    }

    function funds(
        address nft,
        uint256 tokenId
    ) external view returns (uint256) {
        uint256 totalReceived = address(splitter).balance +
            splitter.totalReleased();
        return
            totalReceived.mul(splitter.shares(nft, tokenId)).div(
                splitter.totalShares()
            );
    }

    function release(address nft, uint256 tokenId) public payable override {
        require(
            currentStage() == Status.MATURED ||
                currentStage() == Status.DEFAULTED,
            "RiskControl: statu not in MATURED or DEFAULTED"
        );
        require(msg.sender == nft, "RiskControl: not auth");
        splitter.release(nft, tokenId);
    }

    function release(
        IERC20 token,
        address nft,
        uint256 tokenId
    ) external override {
        require(
            currentStage() == Status.MATURED ||
                currentStage() == Status.DEFAULTED,
            "RiskControl: statu not in MATURED or DEFAULTED"
        );
        require(msg.sender == nft, "RiskControl: not auth");
        splitter.release(token, nft, tokenId);
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
        amount = amount.mul(initialPaymentRatio).div(10000);
        address payable recipientPayable = payable(issuer);
        recipientPayable.transfer(amount);
        initialPaymentClaimed = amount;
        emit ClaimInitialPayment(issuer, amount);
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
        require(sold > 0, "RiskControl: hardrate zero sold");
        require(
            block.timestamp.sub(startTime).div(1 days) > 0,
            "RiskControl: deliver conditions not met"
        );
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
        atStage(Status.DEFAULTED)
    {
        uint256 balance = address(this).balance;
        require(balance > 0, "RiskControl: no funds need liquidate");
        address payable recipientPayable = payable(address(splitter));
        recipientPayable.transfer(balance);
        emit Liquidate(address(splitter), balance);
    }
}
