// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TimestampManipulation {
    mapping(address => uint256) public balances;
    uint256 public lastUpdateTime;
    uint256 public rewardRate = 100; // 100 tokens per day
    
    event RewardClaimed(address indexed user, uint256 amount);
    
    // Vulnerable: Uses block.timestamp for critical logic
    function claimReward() external {
        require(balances[msg.sender] > 0, "No balance");
        
        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        uint256 reward = (timeElapsed * rewardRate) / 1 days;
        
        // Attacker can manipulate timestamp to claim more rewards
        balances[msg.sender] += reward;
        lastUpdateTime = block.timestamp;
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    // Vulnerable: Timestamp-based lottery
    function lottery() external view returns (bool) {
        // Miner can influence outcome
        return block.timestamp % 2 == 0;
    }
    
    // Vulnerable: No access control on admin functions
    function setRewardRate(uint256 newRate) external {
        rewardRate = newRate;
    }
    
    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}
