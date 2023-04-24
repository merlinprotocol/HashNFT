// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRiskControlv2 {
    enum Status {
        INACTIVE,
        ACTIVE,
        MATURED,
        DEFAULTED
    }

    function rewards() external view returns (IERC20);

    function currentStage() external view returns (Status);

    function price() external view returns (uint256);

    function sold() external view returns (uint256);

    function supply() external view returns (uint256);

    function hashrate(address, uint256) external view returns (uint256);

    function rewardBalance(address, uint256) external view returns (uint256);

    function funds(address, uint256) external view returns (uint256);

    function mintAllowed() external view returns (bool);

    function bind(address, uint256, uint256) external payable;

    function release(address, uint256) external payable;

    function release(IERC20, address, uint256) external;
}
