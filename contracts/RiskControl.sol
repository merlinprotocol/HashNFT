// contracts/RiskControl.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IRiskControl.sol";
import "./Stages.sol";


contract RiskControl is IRiskControl, AccessControl, Stages {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event FundsHasIncreased(uint256 amount);
    event InitialPaymentHasGenerated(uint256 ratio);
    event Liquidate(address mt, uint256 balance);

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 public constant defaultInitialPaymentRatio = 3500;

    uint256 public immutable basePrice;

    uint256 public balance = 0;

    uint256 public tax = 0;

    uint256 public taxClaimed = 0;

    uint256 public option = 0;

    uint256 public optionClaimed = 0;

    uint256 public initialPayment = 0;

    uint256 public initialPaymentClaimed = 0;

    IERC20 public immutable funds;

    IOracle public priceOracle;

    mapping(uint256 => uint256) public deliverRecords;

    mapping(uint256 => uint256) public liquidations;

    constructor(
        uint256 startTime_,
        uint256 basePrice_,
        address payment,
        address issuer,
        address po
    ) Stages(startTime_, 7 days, 30 days, 365 days) {
        basePrice = basePrice_;
        funds = IERC20(payment);
        priceOracle = IOracle(po);

        _setupRole(DEFAULT_ADMIN_ROLE, address(this));
        _setupRole(ISSUER_ROLE, issuer);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    function price() public view override returns (uint256) {
        return basePrice + basePrice.mul(10).div(100);
    }

    function increaseFunds(uint256 amount) public override onlyRole(ISSUER_ROLE) {
        funds.transferFrom(msg.sender, address(this), amount);
        uint256 hashrate = amount.div(price());
        tax += basePrice.mul(hashrate).div(100).mul(5);
        option += basePrice.mul(hashrate).div(100).mul(5);
        balance += amount.sub(tax).sub(option);
        emit FundsHasIncreased(amount);
    }

    function deliver(uint256 day, uint256 amount)
        public
        override
        returns (uint256 dayAmount)
    {
        deliverRecords[day] += amount;
        dayAmount = 0;
    }

    function mintAllowed() public view override returns (bool) {
        return _currentStage() == Stage.CollectionPeriod;
    }

    function deliverAllowed() public view override returns (bool) {
        return _currentStage() > Stage.CollectionPeriod;
    }

    function dayNow() public view override returns (uint256) {
        uint256 duration = block.timestamp -
            (startTime + collectionPeriodDuration);
        return duration / 1 days;
    }

    /**
     * @dev Liquidate 
     */
    function liquidate(address liquidator, address mtoken) external override afterStage(Stage.CollectionPeriod) {
        require(hasRole(ADMIN_ROLE, liquidator), "!liquidator");
        funds.safeTransfer(mtoken, balance);
        emit Liquidate(mtoken, balance);
    }

    /**
     * @dev Generate the initial payment by the average bitcoin network power growth rate in the past 
     * year, the option price of bitcoin and lending rates of bitcoin on aave.
     *
     * @param gh Over the past year, the average growth rate of bitcoin's entire network computing power should be multiplied by 10,000
     * @param pc The current value of the option, quoted by the option exchange, needs to be multiplied by 10,000
     * @param rb Bitcoin lending rate, you have to multiply by 10,000
     * Requirements:
     *
     * - `initialPayment` must be the zero.
    */
    function generateInitialPayment(uint256 gh, uint256 rb, uint256 hg, uint256 pc)
        public 
        afterStage(Stage.ObservationPeriod)
        onlyRole(ADMIN_ROLE)
        returns (uint256)
    {
      require(initialPayment == 0, "RiskControl: initial payment not zero");

      uint256 currentPrice = priceOracle.getPrice();
      uint256 d = contractDurationInWeeks - observationDurationInWeeks; // 48
        // uint256 c = 625 * 6 * 24 * 7 * d; // * 100
        uint256 c = 33022100;
        uint256 ph = 100 * c * currentPrice * 10000 * 10000 * 13 * 13 / ((10000 * 13 + 6 * gh) * (10000 * 13 + 6 * rb)); // * 10000
        uint256 a = d * ph / contractDurationInWeeks / hg; // * 10000
        uint b = 100 * 65 * d * basePrice / contractDurationInWeeks; // * 10000
        uint256 r = 0; // R=MAX{(48/52*PH-0.65*48/52*P-PC),0}/P

        if (a > b) {
            r = a - b;
            r /= basePrice;
            if (r > pc) {
                r -= pc;
            }
        }
        uint256 ratio = defaultInitialPaymentRatio * 10; // 35% (constant)+0.5*(0.28(initial risk)-R(current risk))
        if (2800 > r) {
            ratio = ratio + 5 * (2800 - r);
        } else {
            ratio = ratio - 5 * (r - 2800);
        }

        ratio /= 10;
        if (ratio < 2000) {
            ratio = 2000;
        }

        if (ratio > 5000) {
            ratio = 5000;
        }

        initialPayment = balance.mul(ratio).div(10000);
        emit InitialPaymentHasGenerated(ratio);
        return ratio;
    }

    function claimInitialPayment() public onlyRole(ISSUER_ROLE) {
        require(initialPaymentClaimed > initialPayment, "claimed");
        initialPaymentClaimed = initialPayment;
        funds.safeTransfer(msg.sender, initialPayment-initialPaymentClaimed);
    }

    function claimTaxPayment() public onlyRole(ADMIN_ROLE) {
        require(taxClaimed > tax, "claimed");
        taxClaimed = tax;
        funds.safeTransfer(msg.sender, tax-taxClaimed);
    }

    function claimOptionPayment() public onlyRole(ADMIN_ROLE) {
        require(option > optionClaimed, "claimed");
        optionClaimed = option;
        funds.safeTransfer(msg.sender, option-optionClaimed);
    }
}
