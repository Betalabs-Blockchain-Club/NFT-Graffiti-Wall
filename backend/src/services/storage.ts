import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { requiredString, StorageError } from "../db/errors.js";
import { artworkFromRow, DEFAULT_CONFIG, GALLERY_STATUSES, toGalleryItem, validConfigEntry, type Artwork, type ArtworkRow, type ArtworkStatus, type Config, type GalleryStatus } from "../db/types.js";

export interface InsertArtwork { id: string; nickname: string; sha256: string; imageCID?: string; metadataCID?: string; createdAt?: string; idempotencyKey?: string }
export interface MintedArtwork { id: string; tokenId: number; txHash: string; blockNumber: number; imageCID: string; metadataCID: string }
export interface VoteInput { artworkId: string; category: string; voterKey: string }
export interface LikeInput { artworkId: string; browserId: string; liked: boolean }
export interface ListOptions { status?: GalleryStatus; limit?: number; cursor?: string }

const ART_COLS = `id,token_id::int AS token_id,nickname,image_cid,metadata_cid,sha256,tx_hash,block_number::int AS block_number,status,
  to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
  to_char(archived_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS archived_at,idempotency_key,
  to_char(minted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS minted_at`;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createStorage(connectionString: string) {
  const pool = new Pool({ connectionString, ssl: connectionString.includes("sslmode=require") || /neon\.tech/.test(connectionString) ? { rejectUnauthorized: true } : undefined, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  const ready = (async () => {
    await pool.query(schema);
    // Upgrade existing installations additively. Never drop or rewrite data.
    await pool.query("ALTER TABLE artworks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ");
    await pool.query("ALTER TABLE artworks ADD COLUMN IF NOT EXISTS idempotency_key TEXT");
    await pool.query("ALTER TABLE artworks ADD COLUMN IF NOT EXISTS minted_at TIMESTAMPTZ");
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      await pool.query("INSERT INTO config(key,value) VALUES ($1,$2) ON CONFLICT(key) DO NOTHING", [key, JSON.stringify(value)]);
    }
  })();
  const query = async <T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) => { await ready; return pool.query<T>(sql, values); };
  let closing: Promise<void> | undefined;
  async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    await ready; const client = await pool.connect();
    try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  const find = async (id: string) => (await query<ArtworkRow>(`SELECT ${ART_COLS} FROM artworks WHERE id=$1 AND archived_at IS NULL`, [id])).rows[0];
  const mustExist = async (id: string): Promise<Artwork> => { const row = await find(id); if (!row) throw new StorageError("not-found", "Artwork not found", 404); return artworkFromRow(row); };
  async function getConfig(): Promise<Config>;
  async function getConfig<K extends keyof Config>(key: K): Promise<Config[K]>;
  async function getConfig(key?: keyof Config): Promise<Config | Config[keyof Config]> {
    await ready; const result = { ...DEFAULT_CONFIG };
    const rows = await query<{key:string;value:string}>("SELECT key,value FROM config");
    for (const row of rows.rows) { let value: unknown; try { value = JSON.parse(row.value); } catch { value = row.value; }
      if (validConfigEntry(row.key, value)) Object.assign(result, { [row.key]: value }); }
    return key === undefined ? result : result[key];
  }
  async function list({status="approved",limit=48,cursor}: ListOptions={}) {
    if (!GALLERY_STATUSES.includes(status) || !Number.isInteger(limit) || limit<1 || limit>100) throw new StorageError("invalid-query","Invalid gallery status or limit (1-100)");
    let after: {createdAt:string;id:string;status:string}|undefined;
    if (cursor !== undefined) try { if(typeof cursor!=="string"||cursor.length>2048) throw Error(); after=JSON.parse(Buffer.from(cursor,"base64url").toString()); if(!after||typeof after.createdAt!=="string"||typeof after.id!=="string"||after.status!==status) throw Error(); } catch { throw new StorageError("invalid-query","Invalid gallery cursor"); }
    const params: unknown[] = [status]; let where="archived_at IS NULL AND status=$1";
    if(after){params.push(after.createdAt,after.id);where += ` AND (created_at < $2::timestamptz OR (created_at=$2::timestamptz AND id<$3))`;}
    params.push(limit+1); const rows=(await query<ArtworkRow>(`SELECT ${ART_COLS} FROM artworks WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT $${params.length}`,params)).rows;
    const items=rows.slice(0,limit).map(row=>toGalleryItem(artworkFromRow(row))), last=items.at(-1);
    return {items,nextCursor:rows.length>limit&&last?Buffer.from(JSON.stringify({createdAt:last.createdAt,id:last.id,status})).toString("base64url"):null};
  }
  return {
    ready,
    async insertArtwork(input: InsertArtwork) { requiredString(input.id,"id"); requiredString(input.nickname,"nickname",64); if(!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new StorageError("invalid-input","sha256 must be hex64"); const date=input.createdAt===undefined?new Date():new Date(input.createdAt); if(!Number.isFinite(date.getTime())) throw new StorageError("invalid-input","Invalid creation date"); await query("INSERT INTO artworks(id,nickname,sha256,image_cid,metadata_cid,status,created_at,idempotency_key) VALUES($1,$2,$3,$4,$5,'pending',$6,$7)",[input.id,input.nickname,input.sha256.toLowerCase(),input.imageCID??null,input.metadataCID??null,date.toISOString(),input.idempotencyKey??null]); return mustExist(input.id); },
    async getById(id:string){const row=await find(id);return row?artworkFromRow(row):undefined;},
    async getByIdempotencyKey(key:string){const row=(await query<ArtworkRow>(`SELECT ${ART_COLS} FROM artworks WHERE idempotency_key=$1`,[key])).rows[0];return row?artworkFromRow(row):undefined;},
    async setPinned(id:string,imageCID:string,metadataCID:string){await mustExist(id);requiredString(imageCID,"imageCID");requiredString(metadataCID,"metadataCID");await query("UPDATE artworks SET image_cid=$1,metadata_cid=$2 WHERE id=$3 AND archived_at IS NULL AND token_id IS NULL",[imageCID,metadataCID,id]);return mustExist(id);},
    async setMinted(input:MintedArtwork){await mustExist(input.id);if(!Number.isSafeInteger(input.tokenId)||input.tokenId<0||!Number.isSafeInteger(input.blockNumber)||input.blockNumber<0)throw new StorageError("invalid-input","Invalid mint receipt numbers");requiredString(input.txHash,"txHash");requiredString(input.imageCID,"imageCID");requiredString(input.metadataCID,"metadataCID");await query(`UPDATE artworks SET token_id=$1,tx_hash=$2,block_number=$3,image_cid=$4,metadata_cid=$5,minted_at=now(),status=CASE WHEN status IN ('approved','hidden') THEN status ELSE 'minted' END WHERE id=$6 AND archived_at IS NULL`,[input.tokenId,input.txHash,input.blockNumber,input.imageCID,input.metadataCID,input.id]);return mustExist(input.id);},
    async getCertificateDetails(id:string){const r=await query<{tx_hash:string|null;minted_at:string|null}>("SELECT tx_hash,minted_at::text AS minted_at FROM artworks WHERE id=$1 AND archived_at IS NULL",[id]);const row=r.rows[0];if(!row?.tx_hash)throw new StorageError("not-found","Minted artwork certificate data not found",404);return{txHash:row.tx_hash,mintedAt:row.minted_at??""};},
    async setStatus(id:string,status:ArtworkStatus){if(![...GALLERY_STATUSES,"failed"].includes(status))throw new StorageError("invalid-input","Invalid artwork status");await mustExist(id);await query("UPDATE artworks SET status=$1 WHERE id=$2 AND archived_at IS NULL",[status,id]);return mustExist(id);},
    list,
    async getConfig<K extends keyof Config>(key?:K){return getConfig(key as keyof Config) as Promise<K extends keyof Config?Config[K]:Config>;},
    async setConfig(update:Partial<Config>){if(!update||typeof update!=="object"||Array.isArray(update))throw new StorageError("invalid-config","Config must be an object");for(const[k,v]of Object.entries(update))if(!validConfigEntry(k,v))throw new StorageError("invalid-config","Unsupported config key or value");await tx(async c=>{for(const[k,v]of Object.entries(update))await c.query("INSERT INTO config(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[k,JSON.stringify(v)]);});return getConfig();},
    async addVote(input:VoteInput){requiredString(input.artworkId,"artworkId");requiredString(input.category,"category",64);requiredString(input.voterKey,"voterKey");if((await this.getById(input.artworkId))?.status!=="approved")throw new StorageError("not-found","Artwork is not available for voting",404);try{const r=await query<{id:string}>("INSERT INTO votes(artwork_id,category,voter_key) VALUES($1,$2,$3) RETURNING id",[input.artworkId,input.category,input.voterKey]);return{id:Number(r.rows[0].id),...input};}catch(e){if((e as {code?:string}).code==="23505")throw new StorageError("duplicate-vote","Vote already recorded",409);throw e;}},
    async likeSummary(browserId:string){if(!UUID_V4.test(browserId))throw new StorageError("invalid-input","browserId must be a UUID v4");const r=await query<{artworkId:string;likes:string;likedByMe:boolean}>(`SELECT a.id AS "artworkId",COUNT(l.id)::int AS likes,COALESCE(bool_or(l.browser_id=$1),false) AS "likedByMe" FROM artworks a LEFT JOIN likes l ON l.artwork_id=a.id WHERE a.archived_at IS NULL AND a.status='approved' GROUP BY a.id ORDER BY a.created_at DESC,a.id DESC`,[browserId.toLowerCase()]);return r.rows.map(x=>({...x,likes:Number(x.likes),likedByMe:x.likedByMe?1:0}));},
    async setLike(input:LikeInput){requiredString(input.artworkId,"artworkId",128);if(!UUID_V4.test(input.browserId))throw new StorageError("invalid-input","browserId must be a UUID v4");if(typeof input.liked!=="boolean")throw new StorageError("invalid-input","liked must be a boolean");return tx(async c=>{const row=(await c.query("SELECT status FROM artworks WHERE id=$1 AND archived_at IS NULL",[input.artworkId])).rows[0];if(row?.status!=="approved")throw new StorageError("not-found","Artwork is not available for liking",404);const browser=input.browserId.toLowerCase();if(input.liked)await c.query("INSERT INTO likes(artwork_id,browser_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[input.artworkId,browser]);else await c.query("DELETE FROM likes WHERE artwork_id=$1 AND browser_id=$2",[input.artworkId,browser]);const r=await c.query("SELECT COUNT(*)::int AS likes,EXISTS(SELECT 1 FROM likes WHERE artwork_id=$1 AND browser_id=$2) AS liked FROM likes WHERE artwork_id=$1",[input.artworkId,browser]);return{artworkId:input.artworkId,likes:Number(r.rows[0].likes),likedByMe:r.rows[0].liked};});},
    async consumeRateLimit(bucketKey:string,limit:number,now=Date.now()){if(!/^[a-f0-9]{64}$/.test(bucketKey)||!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(now))throw new StorageError("invalid-input","Invalid rate limit bucket");const windowStart=Math.floor(now/60000)*60000;const r=await query<{request_count:number}>(`INSERT INTO api_rate_limits(bucket_key,window_start,request_count) VALUES($1,$2,1) ON CONFLICT(bucket_key) DO UPDATE SET window_start=EXCLUDED.window_start,request_count=CASE WHEN api_rate_limits.window_start=EXCLUDED.window_start THEN api_rate_limits.request_count+1 ELSE 1 END RETURNING request_count`,[bucketKey,windowStart]);await query("DELETE FROM api_rate_limits WHERE window_start<$1",[windowStart]);return{allowed:r.rows[0].request_count<=limit,retryAfterSeconds:Math.max(1,Math.ceil((windowStart+60000-now)/1000))};},
    async leaderboard(){const r=await query<{artworkId:string;category:string;votes:string}>(`SELECT v.artwork_id AS "artworkId",v.category,COUNT(*)::int AS votes FROM votes v JOIN artworks a ON a.id=v.artwork_id WHERE a.archived_at IS NULL AND a.status='approved' GROUP BY v.artwork_id,v.category ORDER BY votes DESC,v.artwork_id,v.category`);return r.rows.map(x=>({...x,votes:Number(x.votes)}));},
    async archiveByStatus(status:ArtworkStatus,excludedIds:string[]=[]){if(!(GALLERY_STATUSES as readonly string[]).includes(status)&&status!=="failed")throw new StorageError("invalid-input","Invalid artwork status");return tx(async c=>{const r=await c.query<{id:string}>("SELECT id FROM artworks WHERE archived_at IS NULL AND status=$1 AND NOT(id=ANY($2::text[]))",[status,excludedIds]);const ids=r.rows.map(x=>x.id);const count=ids.length?Number((await c.query<{count:string}>("SELECT COUNT(*) AS count FROM votes WHERE artwork_id=ANY($1::text[])",[ids])).rows[0].count):0;const archiveId=randomUUID(),createdAt=new Date().toISOString();await c.query("INSERT INTO archive_batches(id,created_at,artwork_count,vote_count) VALUES($1,$2,$3,$4)",[archiveId,createdAt,ids.length,count]);if(ids.length)await c.query("UPDATE artworks SET archived_at=$1 WHERE id=ANY($2::text[])",[createdAt,ids]);return{archiveId,artworkCount:ids.length,voteCount:count,ids};});},
    async archiveArtwork(id:string){return tx(async c=>{const a=await mustExist(id);if(a.status!=="approved")throw new StorageError("not-ready","Only published artwork can be removed from the gallery",409);const count=Number((await c.query("SELECT COUNT(*) AS count FROM votes WHERE artwork_id=$1",[id])).rows[0].count);const archiveId=randomUUID(),createdAt=new Date().toISOString();await c.query("INSERT INTO archive_batches(id,created_at,artwork_count,vote_count) VALUES($1,$2,1,$3)",[archiveId,createdAt,count]);await c.query("UPDATE artworks SET archived_at=$1 WHERE id=$2",[createdAt,id]);return{archiveId,artworkCount:1,voteCount:count,id};});},
    async archiveAll(){return tx(async c=>{const artworkCount=Number((await c.query("SELECT COUNT(*) AS count FROM artworks WHERE archived_at IS NULL")).rows[0].count);const voteCount=Number((await c.query("SELECT COUNT(*) AS count FROM votes v JOIN artworks a ON a.id=v.artwork_id WHERE a.archived_at IS NULL")).rows[0].count);const archiveId=randomUUID(),createdAt=new Date().toISOString();await c.query("INSERT INTO archive_batches(id,created_at,artwork_count,vote_count) VALUES($1,$2,$3,$4)",[archiveId,createdAt,artworkCount,voteCount]);await c.query("UPDATE artworks SET archived_at=$1 WHERE archived_at IS NULL",[createdAt]);return{archiveId,artworkCount,voteCount};});},
    close:()=>{ closing ??= pool.end(); return closing; }
  };
}
export type Storage=ReturnType<typeof createStorage>;
