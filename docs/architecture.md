# Architecture

See README §3. Trust boundaries:
- Backend is trusted for liveness, NOT for verification (verify page re-checks).
- Chain + IPFS gateway are the only dependencies of verification.
- Gallery trusts backend cache + chain events, displays `approved` only.
