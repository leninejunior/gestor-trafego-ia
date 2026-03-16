import { PapiClient, PapiRequestError } from "@/lib/papi/client";
import type { PapiEnv } from "@/lib/papi/env";

describe("PapiClient", () => {
  const env: PapiEnv = {
    baseUrl: "https://papi.example.com",
    apiKey: "api-key",
    groupId: "group-1",
    sendPath: "/messages/group/send",
    timeoutMs: 2000,
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("envia mensagem para grupo com sucesso", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "msg-1", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new PapiClient(env);
    const result = await client.sendGroupMessage({
      groupId: "group-42",
      message: "mensagem de teste",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://papi.example.com/messages/group/send",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.response).toEqual({ id: "msg-1", status: "queued" });
  });

  it("retorna erro tipado quando Papi responde com falha", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid group" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new PapiClient(env);

    await expect(
      client.sendGroupMessage({
        groupId: "invalid-group",
        message: "oi",
      }),
    ).rejects.toBeInstanceOf(PapiRequestError);
  });
});
