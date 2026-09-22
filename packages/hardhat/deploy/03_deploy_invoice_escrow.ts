import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

const deployInvoiceEscrow: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  await hre.deployments.deploy("InvoiceEscrow", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

deployInvoiceEscrow.tags = ["InvoiceEscrow"];
export default deployInvoiceEscrow;
