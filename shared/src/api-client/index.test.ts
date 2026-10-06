import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./index.js";

describe("shared API client", () => {
  it("submits the exact blob as multipart form data", async () => {
    const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ jobId: "job-1", status: "pending" }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      })
    );
    const client = createApiClient({ baseUrl: "http://api.test/", fetchImpl: fetchMock });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

    await expect(client.submitArtwork(blob, "Pixel Fox", "a".repeat(64), "device-1")).resolves.toEqual({
      jobId: "job-1",
      status: "pending"
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe("http://api.test/api/artworks");
    expect(requestInit?.headers).toEqual({ "X-Device-Id": "device-1" });
    const form = requestInit?.body as FormData;
    expect(form.get("nickname")).toBe("Pixel Fox");
    expect(form.get("clientHash")).toBe("a".repeat(64));
    expect(form.get("image")).toBeInstanceOf(Blob);
    expect(await (form.get("image") as Blob).arrayBuffer()).toEqual(await blob.arrayBuffer());
  });

  it("adds admin auth for non-approved gallery reads", async () => {
    const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        headers: { "Content-Type": "application/json" }
      })
    );
    const client = createApiClient({
      baseUrl: "http://api.test",
      adminToken: "secret",
      fetchImpl: fetchMock
    });

    await client.getGallery({ status: "pending", limit: 10, cursor: "next" });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe("http://api.test/api/gallery?status=pending&limit=10&cursor=next");
    expect(requestInit?.headers).toEqual({ Authorization: "Bearer secret" });
  });

  it("throws a typed error for API failures", async () => {
    const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "hash-mismatch", message: "Hashes differ" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    );
    const client = createApiClient({ baseUrl: "http://api.test", fetchImpl: fetchMock });

    await expect(client.getStatus("job-1")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "hash-mismatch",
      message: "Hashes differ"
    } satisfies Partial<ApiError>);
  });

  it("rejects malformed successful responses", async () => {
    const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ nope: true })));
    const client = createApiClient({ baseUrl: "http://api.test", fetchImpl: fetchMock });

    await expect(client.getStatus("job-1")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      code: "invalid_response"
    });
  });
});
