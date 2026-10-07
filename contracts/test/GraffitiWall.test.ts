import { expect } from "chai";
import { ethers } from "hardhat";

describe("GraffitiWall", () => {
  const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const HASH = "0x9f2c7d8a9f2c7d8a9f2c7d8a9f2c7d8a9f2c7d8a9f2c7d8a9f2c7d8a9f2c7d8a";
  const URI = `ipfs://bafybeimetadata`;

  async function deploy() {
    const [admin, minter, stranger] = await ethers.getSigners();
    const F = await ethers.getContractFactory("GraffitiWall");
    const c = await F.deploy();
    return { c, admin, minter, stranger };
  }

  it("mints with MINTER_ROLE, increments id, sets URI + struct, emits event", async () => {
    const { c, admin } = await deploy();
    await expect(c.mint(admin.address, "CyberNinja", CID, HASH, URI))
      .to.emit(c, "ArtworkMinted");
    expect(await c.nextId()).to.equal(2);
    expect(await c.tokenURI(1)).to.equal(URI);
    const a = await c.artworks(1);
    expect(a.nickname).to.equal("CyberNinja");
    expect(a.artworkHash).to.equal(HASH);
  });

  it("reverts for non-minter", async () => {
    const { c, stranger } = await deploy();
    await expect(
      c.connect(stranger).mint(stranger.address, "X", CID, HASH, URI)
    ).to.be.reverted;
  });

  it("verify() true/false", async () => {
    const { c, admin } = await deploy();
    await c.mint(admin.address, "A", CID, HASH, URI);
    expect(await c.verify(1, HASH)).to.equal(true);
    expect(await c.verify(1, "0x0000000000000000000000000000000000000000000000000000000000000001")).to.equal(false);
  });

  it("reverts on empty hash/CID", async () => {
    const { c, admin } = await deploy();
    await expect(
      c.mint(admin.address, "A", CID, "0x0000000000000000000000000000000000000000000000000000000000000000", URI)
    ).to.be.revertedWith("empty hash");
  });

  it("reverts when the nickname exceeds 32 bytes", async () => {
    const { c, admin } = await deploy();
    await expect(c.mint(admin.address, "a".repeat(33), CID, HASH, URI))
      .to.be.revertedWith("nickname too long");
  });
});
