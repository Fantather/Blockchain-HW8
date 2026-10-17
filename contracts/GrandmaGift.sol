// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GrandmaGift {
    struct Grandchild {
        uint256 birthday;
        bool exists;
        bool claimed;
    }

    address public grandma;
    uint256 public giftAmount;
    bool public funded;
    address[] private accounts;
    mapping(address => Grandchild) public grandchildren;

    event GrandchildAdded(address indexed account, uint256 birthday);
    event Deposited(uint256 total, uint256 giftAmount);
    event GiftClaimed(address indexed account, uint256 amount);

    modifier onlyGrandma() {
        require(msg.sender == grandma, "only grandma");
        _;
    }

    constructor() {
        grandma = msg.sender;
    }

    function addGrandchild(address account, uint256 birthday) public onlyGrandma {
        require(!funded, "deposit is already made");
        require(account != address(0), "zero address");
        require(!grandchildren[account].exists, "grandchild already added");
        grandchildren[account] = Grandchild(birthday, true, false);
        accounts.push(account);
        emit GrandchildAdded(account, birthday);
    }

    function deposit() public payable onlyGrandma {
        require(!funded, "deposit is already made");
        require(accounts.length > 0, "no grandchildren");
        require(msg.value >= accounts.length, "deposit is too small");
        funded = true;
        giftAmount = msg.value / accounts.length;
        emit Deposited(msg.value, giftAmount);
    }

    function claimGift() public {
        Grandchild storage child = grandchildren[msg.sender];
        require(child.exists, "not a grandchild");
        require(funded, "no deposit yet");
        require(!child.claimed, "gift already claimed");
        require(block.timestamp >= child.birthday, "birthday has not come yet");

        child.claimed = true;
        emit GiftClaimed(msg.sender, giftAmount);
        (bool ok, ) = payable(msg.sender).call{value: giftAmount}("");
        require(ok, "transfer failed");
    }

    function getGrandchildren() public view returns (address[] memory) {
        return accounts;
    }
}
