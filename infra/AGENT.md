# AGENT.md — `infra/` (Deploy & Booth Infra)

## 1. Purpose
Reproducible hosting: local fallback (Docker), static hosting (verify/gallery), CI checks.

## 2. Inputs
- Root `.env`, Dockerfiles, nginx conf, GitHub workflows.

## 3. Outputs
- `docker-compose up` → backend :3001 + hardhat :8545 + kubo :5001/:8080.
- CI: `hardhat test` + `tsc` + `e2e-mint` against localhost.
- Static deploys for `web-verify` (public URL for QR) + `web-gallery`.

## 4. Responsibilities
Keep images pinned, no secrets in images, document VPS + Vercel steps. Own `infra/docker/Dockerfile.backend`, `infra/nginx/verify.conf`.

## 5. Done
- [ ] Fresh laptop → `docker compose up --build` → full offline demo works.
