// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FlashLoanVulnerable {
    IERC20 public token;
    
    mapping(address => uint256) public balances;
    
    event FlashLoan(address indexed borrower, uint256 amount);
    
    constructor(address _token) {
        token = IERC20(_token);
    }
    
    // Vulnerable: No checks on loan repayment or reentrancy protection
    function executeFlashLoan(uint256 amount) external {
        uint256 balanceBefore = token.balanceOf(address(this));
        
        // Transfer tokens to borrower
        token.transfer(msg.sender, amount);
        
        // Call borrower's callback (vulnerable to reentrancy)
        (bool success, ) = msg.sender.call(abi.encodeWithSignature("receiveFlashLoan(uint256)", amount));
        require(success, "Callback failed");
        
        // Check repayment AFTER callback (reentrancy vulnerable)
        uint256 balanceAfter = token.balanceOf(address(this));
        require(balanceAfter >= balanceBefore, "Loan not repaid");
        
        emit FlashLoan(msg.sender, amount);
    }
    
    // Vulnerable: No access control on deposit
    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
    }
    
    // Vulnerable: No access control on withdraw
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
    }
}
