pragma solidity ^0.8.0;
// contracts/Uint256ToString.sol
// SPDX-License-Identifier: MIT

library Uint256ToString {
    function toFixed(uint256 value, uint8 decimals) internal pure returns (string memory) {
        uint256 scaleFactor = 10 ** decimals;
        uint256 wholePart = value / scaleFactor;
        uint256 fractionalPart = value % scaleFactor;
        string memory wholePartStr = uintToString(wholePart);
        string memory fractionalPartStr = uintToString(fractionalPart);

        while (bytes(fractionalPartStr).length < decimals) {
            fractionalPartStr = string(abi.encodePacked("0", fractionalPartStr));
        }

        return string(abi.encodePacked(wholePartStr, ".", fractionalPartStr));
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        string memory str;
        while (value != 0) {
            uint256 remainder = value % 10;
            value = value / 10;
            str = string(abi.encodePacked(bytes1(uint8(remainder + 48)), str));
        }
        return str;
    }
}
