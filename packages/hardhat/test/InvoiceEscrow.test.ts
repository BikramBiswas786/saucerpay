import { expect } from "chai";
import { ethers } from "hardhat";

describe("InvoiceEscrow", function () {
  async function fixture() {
    const [merchant, payer] = await ethers.getSigners();
    const escrow = await (await ethers.getContractFactory("InvoiceEscrow")).deploy();
    await escrow.waitForDeployment();
    const token = await (await ethers.getContractFactory("HederaToken")).deploy(merchant.address);
    await token.waitForDeployment();
    return { merchant, payer, escrow, token };
  }

  it("accepts HBAR, marks an invoice paid, and lets the merchant withdraw", async function () {
    const { merchant, payer, escrow } = await fixture();
    const amount = ethers.parseEther("1");
    await escrow.connect(merchant).createInvoice(ethers.ZeroAddress, amount, 0, ethers.id("order-1"));
    await expect(escrow.connect(payer).payInvoice(0, ethers.id("receipt-1"), { value: amount }))
      .to.emit(escrow, "InvoicePaid")
      .withArgs(0, payer.address, ethers.ZeroAddress, amount, ethers.id("receipt-1"));
    await expect(escrow.connect(merchant).withdraw(0)).to.emit(escrow, "InvoiceWithdrawn");
  });

  it("uses an HTS-compatible token through the ERC-20 facade", async function () {
    const { merchant, payer, escrow, token } = await fixture();
    const amount = ethers.parseUnits("25", 18);
    await token.transfer(payer.address, amount);
    await escrow.connect(merchant).createInvoice(await token.getAddress(), amount, 0, ethers.id("order-2"));
    await token.connect(payer).approve(await escrow.getAddress(), amount);
    await expect(escrow.connect(payer).payInvoice(0, ethers.id("receipt-2")))
      .to.emit(escrow, "InvoicePaid")
      .withArgs(0, payer.address, await token.getAddress(), amount, ethers.id("receipt-2"));
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);
  });
});
