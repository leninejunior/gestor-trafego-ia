import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/anamnesis/templates/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { getPrismaClient } from "@/lib/prisma";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  getPrismaClient: jest.fn(),
}));

describe("api/anamnesis/templates route", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<
    typeof getTenantContext
  >;
  const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<
    typeof getPrismaClient
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("GET retorna 401 quando nao autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/anamnesis/templates");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("GET retorna 400 para filtro specialty invalido", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
    });

    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        findMany: jest.fn(),
      },
    } as never);

    const request = new NextRequest(
      "http://localhost/api/anamnesis/templates?specialty=INVALID",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Filtro specialty invalido");
  });

  it("GET lista templates filtrando por tenant e specialty", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
    });

    const findMany = jest.fn().mockResolvedValue([
      {
        id: "tpl-1",
        tenantId: "tenant-1",
        specialty: "ESTETICA",
        name: "Template A",
      },
    ]);

    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        findMany,
      },
    } as never);

    const request = new NextRequest(
      "http://localhost/api/anamnesis/templates?specialty=ESTETICA",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          isActive: true,
          specialty: "ESTETICA",
        }),
      }),
    );
  });

  it("POST retorna 400 para body JSON invalido", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
    });

    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        create: jest.fn(),
      },
    } as never);

    const request = new NextRequest("http://localhost/api/anamnesis/templates", {
      method: "POST",
      body: "{invalid-json",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("POST cria template com tenant do contexto", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-9",
      tenantId: "tenant-9",
    });

    const create = jest.fn().mockResolvedValue({
      id: "tpl-9",
      tenantId: "tenant-9",
      specialty: "ESTETICA",
      name: "Template Inicial",
    });

    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        create,
      },
    } as never);

    const request = new NextRequest("http://localhost/api/anamnesis/templates", {
      method: "POST",
      body: JSON.stringify({
        name: "Template Inicial",
        specialty: "ESTETICA",
        description: "Descricao",
        formSchema: { sections: [] },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.id).toBe("tpl-9");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-9",
          createdByUserId: "user-9",
          updatedByUserId: "user-9",
        }),
      }),
    );
  });
});
