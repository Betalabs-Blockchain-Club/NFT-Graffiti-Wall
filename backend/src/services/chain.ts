import {
  Contract,
  Interface,
  JsonRpcProvider,
  NonceManager,
  Wallet,
  formatEther,
  type ContractRunner,
  type EventLog,
  type Log,
  type Provider,
  type TransactionReceipt,
  type TransactionResponse
} from "ethers";

const GRAFFITI_WALL_ABI = [
  "function mint(address to, string nickname, string ipfsCID, bytes32 artworkHash, string metadataURI) returns (uint256 id)",
  "event ArtworkMinted(uint256 indexed tokenId, address indexed creator, string nickname, string ipfsCID, bytes32 artworkHash)"
] as const;

const EVENT_NAME = "ArtworkMinted";
const EVENT_INTERFACE = new Interface(GRAFFITI_WALL_ABI);

export type MintResult = {
  tokenId: number;
  txHash: string;
  blockNumber: number;
};

export type ArtworkMintedRecord = {
  tokenId: number;
  creator: string;
  nickname: string;
  ipfsCID: string;
  artworkHash: string;
  txHash: string;
  blockNumber: number;
};

export type ChainConfig = {
  rpcUrl: string;
  contractAddress: string;
  minterPrivateKey: string;
  confirmations?: number;
  expectedChainId?: number;
  provider?: Provider;
};

export type ChainService = ReturnType<typeof createChain>;

function normalizeArtworkHash(value: string): `0x${string}` {
  const hex = value.replace(/^0x/, "");
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error("artwork hash must be a 32-byte hexadecimal value");
  }
  return `0x${hex}` as `0x${string}`;
}

function parseArtworkMinted(log: Log | EventLog): ArtworkMintedRecord | undefined {
  let parsed;
  try {
    parsed = EVENT_INTERFACE.parseLog({ topics: log.topics, data: log.data });
  } catch {
    return undefined;
  }

  if (!parsed || parsed.name !== EVENT_NAME) return undefined;

  return {
    tokenId: Number(parsed.args[0]),
    creator: String(parsed.args[1]),
    nickname: String(parsed.args[2]),
    ipfsCID: String(parsed.args[3]),
    artworkHash: String(parsed.args[4]),
    txHash: log.transactionHash,
    blockNumber: log.blockNumber
  };
}

function receiptMint(receipt: TransactionReceipt): ArtworkMintedRecord | undefined {
  for (const log of receipt.logs) {
    const parsed = parseArtworkMinted(log);
    if (parsed) return parsed;
  }
  return undefined;
}

export function createChain(config: ChainConfig) {
  const provider = config.provider ?? new JsonRpcProvider(config.rpcUrl);
  const wallet = new Wallet(config.minterPrivateKey, provider);
  const signer = new NonceManager(wallet);
  const contract = new Contract(config.contractAddress, GRAFFITI_WALL_ABI, signer);
  const confirmations = config.confirmations ?? 1;
  let mintTail: Promise<void> = Promise.resolve();

  const runMint = async (
    nickname: string,
    imageCID: string,
    sha256Hex: string,
    metadataURI: string
  ): Promise<MintResult> => {
    const artworkHash = normalizeArtworkHash(sha256Hex);
    const recipient = await signer.getAddress();
    const transaction = (await contract.mint(
      recipient,
      nickname,
      imageCID,
      artworkHash,
      metadataURI
    )) as TransactionResponse;
    const receipt = await transaction.wait(confirmations);
    if (!receipt) throw new Error("mint transaction was not mined");

    const event = receiptMint(receipt);
    if (!event) throw new Error("mint receipt did not contain ArtworkMinted");

    return {
      tokenId: event.tokenId,
      txHash: transaction.hash,
      blockNumber: receipt.blockNumber
    };
  };

  const mint = (
    nickname: string,
    imageCID: string,
    sha256Hex: string,
    metadataURI: string
  ): Promise<MintResult> => {
    const result = mintTail.then(() => runMint(nickname, imageCID, sha256Hex, metadataURI));
    mintTail = result.then(() => undefined, () => undefined);
    return result;
  };

  const backfill = async (
    onMinted: (record: ArtworkMintedRecord) => void | Promise<void>,
    fromBlock: number | string = 0
  ): Promise<number> => {
    const filter = contract.filters.ArtworkMinted();
    const logs = await contract.queryFilter(filter, fromBlock, "latest");
    let count = 0;
    for (const log of logs) {
      const record = parseArtworkMinted(log);
      if (!record) continue;
      await onMinted(record);
      count += 1;
    }
    return count;
  };

  const onArtworkMinted = (
    listener: (record: ArtworkMintedRecord) => void | Promise<void>
  ): (() => void) => {
    const handler = (...args: unknown[]) => {
      const event = args.at(-1) as EventLog | undefined;
      if (!event || !("topics" in event) || !("data" in event)) return;
      const record = parseArtworkMinted(event);
      if (record) void listener(record);
    };
    contract.on(EVENT_NAME, handler);
    return () => {
      contract.off(EVENT_NAME, handler);
    };
  };

  return {
    mint,
    getBalanceEth: async (): Promise<number> => Number(formatEther(await provider.getBalance(await signer.getAddress()))),
    ping: async (): Promise<boolean> => {
      const [blockNumber, network] = await Promise.all([provider.getBlockNumber(), provider.getNetwork()]);
      return blockNumber >= 0 && (config.expectedChainId === undefined || network.chainId === BigInt(config.expectedChainId));
    },
    backfill,
    onArtworkMinted,
    provider,
    contract
  };
}

export { GRAFFITI_WALL_ABI };
