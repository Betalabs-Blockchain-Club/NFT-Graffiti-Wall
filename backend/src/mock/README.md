# Mock API

B0 provides a chain/IPFS-free API fixture for kiosk development. W1 mounts the returned router and Socket.IO hook when `MOCK_API=true`.

The intended local command is:

```sh
MOCK_API=true npm run dev -w backend
```

Set `stageDelayMs` lower in tests; the default advances hashing, uploading, minting, and confirmed over about eight seconds.
