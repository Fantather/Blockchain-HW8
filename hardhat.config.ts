import { defineConfig } from "hardhat/config";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatTypechain from "@nomicfoundation/hardhat-typechain";

export default defineConfig({
  plugins: [hardhatMocha, hardhatEthers, hardhatEthersChaiMatchers, hardhatNetworkHelpers, hardhatTypechain],
  solidity: "0.8.28",
  test: {
    mocha: {
      timeout: 40000,
    },
  },
});