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

  // Case 1: role gating — only minter can mint
  it("reverts for non-minter", async () => {
    const { c, stranger } = await deploy();
    await expect(
      c.connect(stranger).mint(stranger.address, "X", CID, HASH, URI)
    ).to.be.reverted;
  });

  // Case 2: id increments across mints
  it("increments token id across successive mints", async () => {
    const { c, admin } = await deploy();
    await c.mint(admin.address, "Alice", CID, HASH, URI);
    expect(await c.nextId()).to.equal(2);
    await c.mint(admin.address, "Bob", CID, HASH, URI);
    expect(await c.nextId()).to.equal(3);
  });

  // Case 3: verify returns true for correct hash, false for wrong hash
  it("verify() returns true for correct hash and false for wrong hash", async () => {
    const { c, admin } = await deploy();
    await c.mint(admin.address, "A", CID, HASH, URI);
    expect(await c.verify(1, HASH)).to.equal(true);
    expect(
      await c.verify(1, "0x0000000000000000000000000000000000000000000000000000000000000001")
    ).to.equal(false);
  });

  // Case 4: ArtworkMinted event emitted with correct fields
  it("emits ArtworkMinted event with correct fields", async () => {
    const { c, admin } = await deploy();
    await expect(c.mint(admin.address, "CyberNinja", CID, HASH, URI))
      .to.emit(c, "ArtworkMinted")
      .withArgs(1, admin.address, "CyberNinja", CID, HASH);
  });

  // Case 5: tokenURI is set to metadataURI supplied at mint
  it("sets tokenURI to the metadataURI supplied at mint", async () => {
    const { c, admin } = await deploy();
    await c.mint(admin.address, "Tagger", CID, HASH, URI);
    expect(await c.tokenURI(1)).to.equal(URI);
    const a = await c.artworks(1);
    expect(a.nickname).to.equal("Tagger");
    expect(a.artworkHash).to.equal(HASH);
  });

  // Case 6: reverts on zero hash
  it("reverts on empty (zero) artworkHash", async () => {
    const { c, admin } = await deploy();
    await expect(
      c.mint(
        admin.address,
        "A",
        CID,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        URI
      )
    ).to.be.revertedWith("empty hash");
  });

  // Case 7: reverts on empty CID
  it("reverts on empty ipfsCID", async () => {
    const { c, admin } = await deploy();
    await expect(
      c.mint(admin.address, "A", "", HASH, URI)
    ).to.be.revertedWith("empty CID");
  });

  // Case 8: reverts on empty metadataURI
  it("reverts on empty metadataURI", async () => {
    const { c, admin } = await deploy();
    await expect(
      c.mint(admin.address, "A", CID, HASH, "")
    ).to.be.revertedWith("empty URI");
  });

  // Case 9: reverts on nickname longer than 32 chars
  it("reverts when nickname exceeds 32 characters", async () => {
    const { c, admin } = await deploy();
    const longNick = "A".repeat(33);
    await expect(
      c.mint(admin.address, longNick, CID, HASH, URI)
    ).to.be.revertedWith("nickname too long");
  });
});
