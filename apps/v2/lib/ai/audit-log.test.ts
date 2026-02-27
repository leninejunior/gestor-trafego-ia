import { logAiApiAuditEvent } from "@/lib/ai/audit-log";
import { getPrismaClient } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  getPrismaClient: jest.fn(),
}));

describe("GT-24 ai audit log", () => {
  const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<typeof getPrismaClient>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("nao propaga erro quando getPrismaClient falha", async () => {
    mockedGetPrismaClient.mockImplementation(() => {
      throw new Error("prisma init failed");
    });

    await expect(
      logAiApiAuditEvent({
        organizationId: "org-1",
        keyId: "key-1",
        endpoint: "/api/v2/ai/campaigns",
        method: "GET",
        statusCode: 200,
        scope: "ai:read_campaigns",
      }),
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      "[ai-audit] Falha ao registrar auditoria: prisma init failed",
    );
  });
});
