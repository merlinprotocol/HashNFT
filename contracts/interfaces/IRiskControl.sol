// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRiskControl {
    
    function deliver(uint256 day, uint256 amount) external returns (uint256);

    function deliverRecords(uint256) external returns(uint256);

    function mintAllowed() external view returns (bool);

    function deliverAllowed() external view returns (bool);

    function increaseFunds(uint256) external;

    function dayNow() external view returns (uint256);

    function price() external view returns (uint256);

    function liquidate(address, address) external;
}
