// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "Insufficient balance");

        // VULNERABILITY 1: Low-level call before state update (Reentrancy)
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0;
    }

    function withdrawPhishing(address payable target) external {
        // VULNERABILITY 2: Authentication using tx.origin
        require(tx.origin == msg.sender, "Not authorized");
        target.transfer(address(this).balance);
    }
}
