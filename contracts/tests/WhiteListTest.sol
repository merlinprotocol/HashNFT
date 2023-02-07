// contracts/WhitelistERC20.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract WhiteListTest {
    bytes32 public immutable rootHash;

    constructor(bytes32 _rootHash) {
        rootHash = _rootHash;
    }

    function verify(bytes32[] calldata _merkleProof) public view  returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        return MerkleProof.verify(_merkleProof, rootHash, leaf); // Or you can mint tokens here
    }
}