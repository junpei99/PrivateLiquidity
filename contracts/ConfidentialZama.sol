// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract ConfidentialZama is ERC7984, ZamaEthereumConfig {
    constructor() ERC7984("cZama", "cZama", "") {}

    function mint(address to, uint64 amount) public {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        _mint(to, encryptedAmount);
    }

    function operatorTransferFrom(address from, address to, uint64 amount) external returns (euint64) {
        require(isOperator(from, msg.sender), ERC7984UnauthorizedSpender(from, msg.sender));
        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allow(encryptedAmount, msg.sender);
        FHE.allowTransient(encryptedAmount, msg.sender);
        return _transfer(from, to, encryptedAmount);
    }

    function operatorTransfer(address to, uint64 amount) external returns (euint64) {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allow(encryptedAmount, msg.sender);
        FHE.allowTransient(encryptedAmount, msg.sender);
        return _transfer(msg.sender, to, encryptedAmount);
    }
}
