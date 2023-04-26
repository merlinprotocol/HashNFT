// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockAggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = 92233720368547792792;
        answer = 2734413491000;
        startedAt = 1682412947;
        updatedAt = 1682412947;
        answeredInRound = 92233720368547792792;
    }
}
