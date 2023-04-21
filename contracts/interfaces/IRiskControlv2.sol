// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRiskControlv2 {
    function price() external view returns (uint256);

    function sold() external view returns (uint256);

    function supply() external view returns (uint256);

    function hashrate(address, uint256) external view returns (uint256);

    function rewardBalance(address, uint256) external view returns (uint256);

    function mintAllowed() external view returns (bool);

    function bind(address, uint256, uint256) external payable;
}
