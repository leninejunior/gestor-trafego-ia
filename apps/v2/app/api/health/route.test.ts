import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("retorna payload de healthcheck", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("flying-fox-v2");
    expect(typeof payload.timestamp).toBe("string");
  });
});
