// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IEarningsOracle.sol";

contract MockEarningsOracle is IEarningsOracle {
    constructor() {
    }

    function lastRound() external override view returns (uint256, uint256) {
        return (block.timestamp /1 days, block.timestamp /1 days);
    }

    function getRound(uint256) external override view returns (uint256) {
        return block.timestamp /1 days;
    }
}