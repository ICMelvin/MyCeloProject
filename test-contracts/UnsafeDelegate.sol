// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UnsafeDelegate {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function executeCall(address target, bytes calldata data) external {
        // VULNERABILITY: Arbitrary delegatecall allows context hijacking
        (bool success, ) = target.delegatecall(data);
        require(success, "Delegatecall failed");
    }
}
