// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title GraffitiWall — TechFest expo proof-of-existence NFT
/// @notice Stores SHA-256 of exact PNG bytes + IPFS CID on-chain. See contracts/AGENT.md.
contract GraffitiWall is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Artwork {
        address creator;
        string nickname;
        string ipfsCID;
        bytes32 artworkHash;
        uint64 timestamp;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Artwork) public artworks;

    event ArtworkMinted(
        uint256 indexed tokenId,
        address indexed creator,
        string nickname,
        string ipfsCID,
        bytes32 artworkHash
    );

    constructor() ERC721("Blockchain Graffiti Wall", "GRAFFITI") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(
        address to,
        string calldata nickname,
        string calldata ipfsCID,
        bytes32 artworkHash,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256 id) {
        require(bytes(ipfsCID).length > 0, "empty CID");
        require(bytes(metadataURI).length > 0, "empty URI");
        require(artworkHash != bytes32(0), "empty hash");
        require(bytes(nickname).length <= 32, "nickname too long");
        id = nextId++;
        _safeMint(to, id);
        _setTokenURI(id, metadataURI);
        artworks[id] = Artwork(to, nickname, ipfsCID, artworkHash, uint64(block.timestamp));
        emit ArtworkMinted(id, to, nickname, ipfsCID, artworkHash);
    }

    function verify(uint256 id, bytes32 candidateHash) external view returns (bool) {
        return artworks[id].artworkHash == candidateHash;
    }

    function supportsInterface(bytes4 i)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(i);
    }
}
