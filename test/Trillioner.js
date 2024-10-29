const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Trillioner Token contract Deployment", function () {
  async function deployTokenFixture() {
    const [owner] = await ethers.getSigners();
    const trillionerToken = await ethers.deployContract("Trillioner");

    return { owner, trillionerToken };
  }

  it("Deployment should assign the total supply of tokens to the owner", async function () {
    const { owner, trillionerToken } = await loadFixture(deployTokenFixture);
    const ownerBalance = await trillionerToken.balanceOf(owner.address);
    expect(await trillionerToken.totalSupply()).to.equal(ownerBalance);
  });

  it("Should set the right owner", async function () {
    const { owner, trillionerToken } = await loadFixture(deployTokenFixture);
    expect(await trillionerToken.owner()).to.equal(owner.address);
  });

  it("Token name is correct", async function () {
    const { trillionerToken } = await loadFixture(deployTokenFixture);
    expect(await trillionerToken.name()).to.equal("Trillioner");
  });

  it("Token symbol is correct", async function () {
    const { trillionerToken } = await loadFixture(deployTokenFixture);
    expect(await trillionerToken.symbol()).to.equal("TLC");
  });

  it("Token decimal is correct", async function () {
    const { trillionerToken } = await loadFixture(deployTokenFixture);
    expect(await trillionerToken.decimals()).to.equal(18);
  });

  it("Token total supply is correct", async function () {
    const { trillionerToken } = await loadFixture(deployTokenFixture);
    const initialSupply = ethers.parseUnits(
      "1000000000",
      await trillionerToken.decimals()
    );
    expect(await trillionerToken.totalSupply()).to.equal(initialSupply);
  });
});

describe("Transfer Function", function () {
  async function deployTokenFixture() {
    const [owner, addr1] = await ethers.getSigners();
    const trillionerToken = await ethers.deployContract("Trillioner");

    return { owner, addr1, trillionerToken };
  }

  it("Should transfer tokens successfully", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    expect(trillionerToken.connect(owner.address).transfer(addr1, amount));
  });

  it("Should fail to transfer to the zero address", async function () {
    const { trillionerToken } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("100", 18);
    const address = "0x0000000000000000000000000000000000000000";
    await expect(trillionerToken.transfer(address, amount)).to.be.revertedWith(
      "ERC20: transfer to the zero address"
    );
  });

  it("Should fail to transfer to self", async function () {
    const { owner, trillionerToken } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("100", 18);

    await expect(
      trillionerToken.connect(owner).transfer(owner.address, amount)
    ).to.be.revertedWith("Invalid target");
  });

  it("Should fail to transfer if sender has insufficient balance", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    await expect(
      trillionerToken.connect(addr1).transfer(owner.address, amount) // Trying to transfer locked tokens
    ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("Should fail to transfer if transfer amount exceeds withdrawable amount due to locking", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    await trillionerToken
      .connect(owner)
      .transferWithVesting(addr1.address, amount, 2, 10);

    await expect(
      trillionerToken.connect(addr1).transfer(owner.address, amount) // Trying to transfer locked tokens
    ).to.be.revertedWith("Not enough Unlocked token Available");
  });

  it("Should allow to transfer if sender has unlocked tokens", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    await trillionerToken
      .connect(owner)
      .transferWithVesting(addr1.address, amount, 2, 50);

    // Simulate passing of time to unlock tokens
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]); // Fast forward 3 days
    await ethers.provider.send("evm_mine"); // Mine the next block

    const unlockAmount = await trillionerToken.unlock(addr1.address);

    expect(
      trillionerToken.connect(addr1).transfer(owner.address, unlockAmount) // Trying to transfer locked tokens
    );
  });

  it("Should update balances correctly after a transfer", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    await trillionerToken.transfer(addr1.address, amount);

    const addr1Balance = await trillionerToken.balanceOf(addr1.address);
    expect(addr1Balance).to.equal(amount);
  });
});

describe("Transfer With Vesting Function", function () {
  async function deployTokenFixture() {
    const [owner, addr1] = await ethers.getSigners();
    const trillionerToken = await ethers.deployContract("Trillioner");

    return { owner, addr1, trillionerToken };
  }

  it("Should transfer tokens with vesting successfully", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    expect(
      trillionerToken
        .connect(owner.address)
        .transferWithVesting(addr1.address, amount, 5, 50)
    );
  });

  it("Should fail to transfer to the zero address", async function () {
    const { owner, trillionerToken } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("100", 18);
    const address = "0x0000000000000000000000000000000000000000";
    expect(
      trillionerToken
        .connect(owner.address)
        .transferWithVesting(address, amount, 5, 50)
    ).to.be.revertedWith("Invalid target");
  });

  it("Should fail to transfer if the recipient already has a vesting schedule", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    trillionerToken
      .connect(owner.address)
      .transferWithVesting(addr1.address, amount, 5, 50);

    expect(
      trillionerToken
        .connect(owner.address)
        .transferWithVesting(addr1.address, amount, 5, 50)
    ).to.be.revertedWith("This address is already in vesting period");
  });

  it("Should emit Transfer event with correct arguments", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    const amount = ethers.parseUnits("100", 18);

    expect(
      trillionerToken
        .connect(owner.address)
        .transferWithVesting(addr1.address, amount, 5, 50)
    )
      .to.emit(trillionerToken, "Transfer")
      .withArgs(owner.address, addr1.address, amount);
  });

  it("Should properly lock tokens in the vesting schedule", async function () {
    const { addr1, trillionerToken } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("100", 18);

    await trillionerToken.transferWithVesting(addr1.address, amount, 30, 10);

    const lockDetails = await trillionerToken.locks(addr1.address);

    expect(lockDetails.lockedToken).to.equal(amount);
  });
});

describe("Unlock Function", function () {
  async function deployTokenFixture() {
    const [owner, addr1] = await ethers.getSigners();
    const trillionerToken = await ethers.deployContract("Trillioner");
    const amount = ethers.parseUnits("100", 18);

    await trillionerToken.transferWithVesting(addr1.address, amount, 30, 10);

    return { owner, addr1, amount, trillionerToken };
  }

  it("Should Unlock tokens successfully after the unlocking period", async function () {
    const { owner, addr1, amount, trillionerToken } = await loadFixture(
      deployTokenFixture
    );

    await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    const lockDetails = await trillionerToken.locks(addr1.address);
    expect(lockDetails.remainingLockedToken).to.equal(amount);
  });

  it("Should fail to unlock tokens if the target address is the zero address", async function () {
    const { trillionerToken } = await loadFixture(deployTokenFixture);
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    await expect(trillionerToken.unlock(zeroAddress)).to.be.revertedWith(
      "Target address can not be zero address"
    );
  });

  it("Should fail to unlock if the unlocking period is not opened", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );
    await expect(trillionerToken.unlock(addr1.address)).to.be.revertedWith(
      "UnLocking period is not opened"
    );
  });

  it("Should fail to unlock if no tokens are available for release", async function () {
    const { owner, addr1, trillionerToken } = await loadFixture(
      deployTokenFixture
    );

    await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await trillionerToken.unlock(addr1.address);

    await expect(trillionerToken.unlock(addr1.address)).to.be.revertedWith(
      "Releasable token till now is released"
    );
  });

  it("Should fail to unlock if all tokens are already unlocked", async function () {
    const { addr1, owner, amount, trillionerToken } = await loadFixture(
      deployTokenFixture
    );

    await ethers.provider.send("evm_increaseTime", [60 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await trillionerToken.unlock(addr1.address);

    trillionerToken.connect(addr1).transfer(owner, amount);

    expect(trillionerToken.unlock(addr1.address)).to.be.revertedWith(
      "All tokens are unlocked"
    );
  });
});
