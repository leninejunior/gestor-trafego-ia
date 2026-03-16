import { NextRequest } from "next/server";

import {
  DELETE,
  GET,
  PATCH,
} from "@/app/api/anamnesis/templates/[templateId]/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { getPrismaClient } from "@/lib/prisma";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  getPrismaClient: jest.fn(),
}));

describe("api/anamnesis/templates/[templateId] route", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<
    typeof getTenantContext
  >;
  const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<
    typeof getPrismaClient
  >;

  const routeContext = {
    params: Promise.resolve({ templateId: "tpl-1" }),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("GET retorna 401 quando nao autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue(null);
    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        findFirst: jest.fn(),
      },
    } as never);

    const request = new NextRequest("http://localhost/api/anamnesis/templates/tpl-1");
    const response = await GET(request, routeContext);

    expect(response.status).toBe(401);
  });

  it("GET retorna 404 quando template nao existe no tenant", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
    });

    const findFirst = jest.fn().mockResolvedValue(null);
    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        findFirst,
      },
    } as never);

    const request = new NextRequest("http://localhost/api/anamnesis/templates/tpl-1");
    const response = await GET(request, routeContext);

    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1", tenantId: "tenant-1" },
      }),
    );
  });

  it("PATCH retorna 400 para payload invalido", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
    });

    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: "tpl-1",
          tenantId: "tenant-1",
        }),
        update: jest.fn(),
      },
    } as never);

    const request = new NextRequest("http://localhost/api/anamnesis/templates/tpl-1", {
      method: "PATCH",
      body: JSON.stringify("bad-payload"),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, routeContext);
    expect(response.status).toBe(400);
  });

  it("PATCH atualiza template no tenant autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-5",
      tenantId: "tenant-5",
    });

    const findFirst = jest.fn().mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-5",
      name: "Template Antigo",
    });

    const update = jest.fn().mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-5",
      name: "Template Novo",
      isActive: true,
    });

    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        findFirst,
        update,
      },
    } as never);

    const request = new NextRequest("http://localhost/api/anamnesis/templates/tpl-1", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Template Novo",
        isActive: true,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, routeContext);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Template Novo");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1", tenantId: "tenant-5" },
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({
          name: "Template Novo",
          isActive: true,
          updatedByUserId: "user-5",
        }),
      }),
    );
  });

  it("DELETE faz arquivamento logico (isActive=false)", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-7",
      tenantId: "tenant-7",
    });

    const findFirst = jest.fn().mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-7",
      isActive: true,
    });

    const update = jest.fn().mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-7",
      isActive: false,
    });

    mockedGetPrismaClient.mockReturnValue({
      anamnesisTemplate: {
        findFirst,
        update,
      },
    } as never);

    const request = new NextRequest("http://localhost/api/anamnesis/templates/tpl-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, routeContext);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.isActive).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({
          isActive: false,
          updatedByUserId: "user-7",
        }),
      }),
    );
  });
});
