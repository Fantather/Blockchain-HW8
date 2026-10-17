import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.getOrCreate();
const { loadFixture, time } = networkHelpers;

const DAY = 24 * 60 * 60;
const DEPOSIT = ethers.parseEther("10") + 1n;

async function deployFixture() {
  const [grandma, kid1, kid2, kid3, stranger] = await ethers.getSigners();
  const gift = await ethers.deployContract("GrandmaGift", [], grandma);

  const now = await time.latest();
  const birthdays = [now + DAY, now + 10 * DAY, now + 30 * DAY];
  await gift.addGrandchild(kid1.address, birthdays[0]);
  await gift.addGrandchild(kid2.address, birthdays[1]);
  await gift.addGrandchild(kid3.address, birthdays[2]);

  return { gift, grandma, kid1, kid2, kid3, stranger, birthdays };
}

async function fundedFixture() {
  const base = await deployFixture();
  await base.gift.deposit({ value: DEPOSIT });
  const giftAmount: bigint = await base.gift.giftAmount();
  return { ...base, giftAmount };
}

describe("GrandmaGift", () => {
  describe("setup", () => {
    it("grandma deploys the contract", async () => {
      const [grandma] = await ethers.getSigners();
      const gift = await ethers.deployContract("GrandmaGift", [], grandma);

      expect(await gift.grandma()).to.equal(grandma.address);
      expect(await gift.funded()).to.equal(false);
      expect(await gift.getGrandchildren()).to.deep.equal([]);
    });

    it("grandma adds grandchildren with birthdays", async () => {
      const { gift, kid1, kid2, kid3, birthdays } = await loadFixture(deployFixture);

      expect(await gift.getGrandchildren()).to.deep.equal([kid1.address, kid2.address, kid3.address]);

      const kids = [kid1, kid2, kid3];
      for (let i = 0; i < kids.length; i++) {
        const child = await gift.grandchildren(kids[i].address);
        expect(child.birthday).to.equal(birthdays[i]);
        expect(child.exists).to.equal(true);
        expect(child.claimed).to.equal(false);
      }
    });

    it("emits event when grandchild is added", async () => {
      const { gift, stranger } = await loadFixture(deployFixture);
      const birthday = (await time.latest()) + DAY;

      await expect(gift.addGrandchild(stranger.address, birthday))
        .to.emit(gift, "GrandchildAdded")
        .withArgs(stranger.address, birthday);
    });

    it("grandma deposits funds", async () => {
      const { gift } = await loadFixture(deployFixture);

      await expect(gift.deposit({ value: DEPOSIT }))
        .to.emit(gift, "Deposited")
        .withArgs(DEPOSIT, DEPOSIT / 3n);

      expect(await gift.funded()).to.equal(true);
      expect(await ethers.provider.getBalance(await gift.getAddress())).to.equal(DEPOSIT);
    });
  });

  describe("split", () => {
    it("splits deposit evenly", async () => {
      const { gift } = await loadFixture(deployFixture);
      const total = ethers.parseEther("9");

      await gift.deposit({ value: total });

      expect(await gift.giftAmount()).to.equal(ethers.parseEther("3"));
    });

    it("rounds gift down when deposit has remainder", async () => {
      const { gift, giftAmount } = await loadFixture(fundedFixture);

      expect(giftAmount).to.equal(DEPOSIT / 3n);
      expect(giftAmount).to.equal(3333333333333333333n);
      expect(DEPOSIT - giftAmount * 3n).to.equal(2n);
      expect(await ethers.provider.getBalance(await gift.getAddress())).to.equal(DEPOSIT);
    });
  });

  describe("claim", () => {
    it("claims exactly on birthday", async () => {
      const { gift, kid1, giftAmount, birthdays } = await loadFixture(fundedFixture);

      await time.setNextBlockTimestamp(birthdays[0]);

      await expect(gift.connect(kid1).claimGift()).to.changeEtherBalances(
        ethers,
        [kid1, gift],
        [giftAmount, -giftAmount],
      );
      expect((await gift.grandchildren(kid1.address)).claimed).to.equal(true);
    });

    it("claims after birthday", async () => {
      const { gift, kid2, giftAmount, birthdays } = await loadFixture(fundedFixture);

      await time.increaseTo(birthdays[1] + 5 * DAY);

      await expect(gift.connect(kid2).claimGift()).to.changeEtherBalances(
        ethers,
        [kid2, gift],
        [giftAmount, -giftAmount],
      );
    });

    it("rejects claim before birthday", async () => {
      const { gift, kid1 } = await loadFixture(fundedFixture);

      await expect(gift.connect(kid1).claimGift()).to.be.revertedWith("birthday has not come yet");
    });

    it("rejects second claim", async () => {
      const { gift, kid1, birthdays } = await loadFixture(fundedFixture);
      await time.increaseTo(birthdays[0]);
      await gift.connect(kid1).claimGift();

      await expect(gift.connect(kid1).claimGift()).to.be.revertedWith("gift already claimed");
    });

    it("rejects claim before deposit", async () => {
      const { gift, kid1, birthdays } = await loadFixture(deployFixture);
      await time.increaseTo(birthdays[0]);

      await expect(gift.connect(kid1).claimGift()).to.be.revertedWith("no deposit yet");
    });

    it("emits event with address and amount on claim", async () => {
      const { gift, kid3, giftAmount, birthdays } = await loadFixture(fundedFixture);
      await time.increaseTo(birthdays[2]);

      await expect(gift.connect(kid3).claimGift())
        .to.emit(gift, "GiftClaimed")
        .withArgs(kid3.address, giftAmount);
    });
  });

  describe("outsiders", () => {
    it("rejects claim from non grandchild", async () => {
      const { gift, stranger, birthdays } = await loadFixture(fundedFixture);
      await time.increaseTo(birthdays[2]);

      await expect(gift.connect(stranger).claimGift()).to.be.revertedWith("not a grandchild");
    });

    it("rejects addGrandchild from non grandma", async () => {
      const { gift, stranger } = await loadFixture(deployFixture);
      const birthday = (await time.latest()) + DAY;

      await expect(gift.connect(stranger).addGrandchild(stranger.address, birthday)).to.be.revertedWith(
        "only grandma",
      );
      expect(await gift.getGrandchildren()).to.have.lengthOf(3);
    });

    it("rejects deposit from non grandma", async () => {
      const { gift, stranger } = await loadFixture(deployFixture);

      await expect(gift.connect(stranger).deposit({ value: DEPOSIT })).to.be.revertedWith("only grandma");
      expect(await gift.funded()).to.equal(false);
    });
  });
});
