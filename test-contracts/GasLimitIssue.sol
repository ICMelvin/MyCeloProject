// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GasLimitIssue {
    address[] public users;
    mapping(address => uint256) public balances;
    address public owner = 0x1234567890123456789012345678901234567890; // Hardcoded
    
    event UserAdded(address indexed user);
    event AirdropCompleted(uint256 count);
    
    // Vulnerable: Loop over dynamic array can exceed gas limit
    function airdrop() external {
        for (uint256 i = 0; i < users.length; i++) {
            balances[users[i]] += 1 ether;
        }
        emit AirdropCompleted(users.length);
    }
    
    // Vulnerable: Unbounded loop
    function distributeRewards(uint256[] calldata amounts) external {
        require(amounts.length == users.length, "Length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            balances[users[i]] += amounts[i];
        }
    }
    
    function addUser(address user) external {
        users.push(user);
        emit UserAdded(user);
    }
    
    // Vulnerable: No access control
    function emergencyWithdraw() external {
        payable(owner).transfer(address(this).balance);
    }
    
    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
}
