// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialETH} from "./ConfidentialETH.sol";
import {ConfidentialZama} from "./ConfidentialZama.sol";

contract ConfidentialSwap is ZamaEthereumConfig {
    ConfidentialETH public immutable cEth;
    ConfidentialZama public immutable cZama;

    uint256 public constant FEE_NUMERATOR = 997;
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint64 public constant INITIAL_PRICE = 2000;

    uint256 public reserveEth;
    uint256 public reserveZama;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidityOf;

    event LiquidityAdded(address indexed provider, uint64 cEthAmount, uint64 cZamaAmount, uint256 mintedLiquidity);
    event LiquidityRemoved(address indexed provider, uint64 cEthAmount, uint64 cZamaAmount, uint256 burnedLiquidity);
    event Swap(address indexed sender, bool ethForZama, uint64 amountIn, uint64 amountOut);

    constructor(ConfidentialETH _cEth, ConfidentialZama _cZama) {
        cEth = _cEth;
        cZama = _cZama;
    }

    function getReserves() external view returns (uint256 cEthReserve, uint256 cZamaReserve) {
        return (reserveEth, reserveZama);
    }

    function getLiquidity(address account) external view returns (uint256) {
        return liquidityOf[account];
    }

    function quoteEthToZama(uint64 amountIn) external view returns (uint64) {
        return _calculateAmountOut(amountIn, reserveEth, reserveZama);
    }

    function quoteZamaToEth(uint64 amountIn) external view returns (uint64) {
        return _calculateAmountOut(amountIn, reserveZama, reserveEth);
    }

    function addLiquidity(uint64 cEthAmount, uint64 cZamaAmount) external returns (uint256 mintedLiquidity) {
        require(cEthAmount > 0 && cZamaAmount > 0, "Zero liquidity");

        if (totalLiquidity == 0) {
            require(cZamaAmount == cEthAmount * INITIAL_PRICE, "Initial price must be 1:2000");
            mintedLiquidity = _sqrt(uint256(cEthAmount) * uint256(cZamaAmount));
        } else {
            require(reserveEth > 0 && reserveZama > 0, "Pool not initialized");
            uint256 liquidityFromEth = (uint256(cEthAmount) * totalLiquidity) / reserveEth;
            uint256 liquidityFromZama = (uint256(cZamaAmount) * totalLiquidity) / reserveZama;
            mintedLiquidity = _min(liquidityFromEth, liquidityFromZama);
        }

        require(mintedLiquidity > 0, "Insufficient liquidity minted");

        _pullTokens(msg.sender, cEthAmount, cZamaAmount);

        reserveEth += cEthAmount;
        reserveZama += cZamaAmount;
        totalLiquidity += mintedLiquidity;
        liquidityOf[msg.sender] += mintedLiquidity;

        emit LiquidityAdded(msg.sender, cEthAmount, cZamaAmount, mintedLiquidity);
    }

    function removeLiquidity(
        uint256 liquidityAmount,
        uint64 minEthAmount,
        uint64 minZamaAmount
    ) external returns (uint64 cEthAmount, uint64 cZamaAmount) {
        require(liquidityAmount > 0, "Nothing to burn");
        require(liquidityOf[msg.sender] >= liquidityAmount, "Not enough liquidity");
        require(totalLiquidity > 0, "Empty pool");

        cEthAmount = uint64((liquidityAmount * reserveEth) / totalLiquidity);
        cZamaAmount = uint64((liquidityAmount * reserveZama) / totalLiquidity);

        require(cEthAmount >= minEthAmount && cZamaAmount >= minZamaAmount, "Slippage");
        require(reserveEth >= cEthAmount && reserveZama >= cZamaAmount, "Reserves too low");

        liquidityOf[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;
        reserveEth -= cEthAmount;
        reserveZama -= cZamaAmount;

        _pushTokens(msg.sender, cEthAmount, cZamaAmount);

        emit LiquidityRemoved(msg.sender, cEthAmount, cZamaAmount, liquidityAmount);
    }

    function swapEthForZama(uint64 cEthAmountIn, uint64 minZamaOut) external returns (uint64 amountOut) {
        amountOut = _swap(cEthAmountIn, minZamaOut, true);
    }

    function swapZamaForEth(uint64 cZamaAmountIn, uint64 minEthOut) external returns (uint64 amountOut) {
        amountOut = _swap(cZamaAmountIn, minEthOut, false);
    }

    function _swap(uint64 amountIn, uint64 minAmountOut, bool ethForZama) internal returns (uint64 amountOut) {
        require(amountIn > 0, "Amount too small");
        require(reserveEth > 0 && reserveZama > 0, "Pool not initialized");

        if (ethForZama) {
            amountOut = _calculateAmountOut(amountIn, reserveEth, reserveZama);
            require(amountOut >= minAmountOut, "Insufficient output");
            require(reserveZama >= amountOut, "Not enough cZama");

            _pullTokens(msg.sender, amountIn, 0);
            reserveEth += amountIn;
            reserveZama -= amountOut;
            _pushTokens(msg.sender, 0, amountOut);
        } else {
            amountOut = _calculateAmountOut(amountIn, reserveZama, reserveEth);
            require(amountOut >= minAmountOut, "Insufficient output");
            require(reserveEth >= amountOut, "Not enough cETH");

            _pullTokens(msg.sender, 0, amountIn);
            reserveZama += amountIn;
            reserveEth -= amountOut;
            _pushTokens(msg.sender, amountOut, 0);
        }

        emit Swap(msg.sender, ethForZama, amountIn, amountOut);
    }

    function _calculateAmountOut(
        uint64 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint64) {
        if (reserveIn == 0 || reserveOut == 0) {
            return 0;
        }

        uint256 amountInWithFee = uint256(amountIn) * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        uint256 result = denominator == 0 ? 0 : numerator / denominator;

        if (result > type(uint64).max) {
            result = type(uint64).max;
        }

        return uint64(result);
    }

    function _pullTokens(address from, uint64 ethAmount, uint64 zamaAmount) internal {
        if (ethAmount > 0) {
            cEth.operatorTransferFrom(from, address(this), ethAmount);
        }

        if (zamaAmount > 0) {
            cZama.operatorTransferFrom(from, address(this), zamaAmount);
        }

    }

    function _pushTokens(address to, uint64 ethAmount, uint64 zamaAmount) internal {
        if (ethAmount > 0) {
            cEth.operatorTransfer(to, ethAmount);
        }

        if (zamaAmount > 0) {
            cZama.operatorTransfer(to, zamaAmount);
        }
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) {
            return 0;
        }
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
