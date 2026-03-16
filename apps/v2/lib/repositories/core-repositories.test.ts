import { describe, expect, it, jest } from "@jest/globals";

import {
  CampaignRepository,
  ClientRepository,
  MembershipRepository,
  MetaConnectionRepository,
  OrganizationRepository,
} from "@/lib/repositories/core-repositories";

function createMockPrisma() {
  const mockAsync = () => jest.fn<(...args: any[]) => Promise<any>>();

  return {
    organization: {
      create: mockAsync(),
      findUnique: mockAsync(),
      findMany: mockAsync(),
      update: mockAsync(),
      delete: mockAsync(),
    },
    membership: {
      create: mockAsync(),
      findUnique: mockAsync(),
      findMany: mockAsync(),
      update: mockAsync(),
      delete: mockAsync(),
    },
    client: {
      create: mockAsync(),
      findUnique: mockAsync(),
      findMany: mockAsync(),
      update: mockAsync(),
      delete: mockAsync(),
    },
    metaConnection: {
      create: mockAsync(),
      findUnique: mockAsync(),
      findMany: mockAsync(),
      update: mockAsync(),
      delete: mockAsync(),
    },
    campaign: {
      create: mockAsync(),
      findUnique: mockAsync(),
      findMany: mockAsync(),
      update: mockAsync(),
      delete: mockAsync(),
    },
  };
}

describe("OrganizationRepository", () => {
  it("cobre CRUD basico", async () => {
    const prisma = createMockPrisma();
    const repository = new OrganizationRepository(prisma as never);

    prisma.organization.create.mockResolvedValue({ id: "org_1" });
    await repository.create({ name: "Org 1" });
    expect(prisma.organization.create).toHaveBeenCalledWith({
      data: { name: "Org 1" },
    });

    prisma.organization.findUnique.mockResolvedValue({ id: "org_1" });
    await repository.findById("org_1");
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "org_1" },
    });

    prisma.organization.update.mockResolvedValue({ id: "org_1", name: "Org X" });
    await repository.update("org_1", { name: "Org X" });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org_1" },
      data: { name: "Org X" },
    });

    prisma.organization.delete.mockResolvedValue({ id: "org_1" });
    await repository.delete("org_1");
    expect(prisma.organization.delete).toHaveBeenCalledWith({
      where: { id: "org_1" },
    });
  });
});

describe("MembershipRepository", () => {
  it("cobre CRUD basico", async () => {
    const prisma = createMockPrisma();
    const repository = new MembershipRepository(prisma as never);

    const createData = {
      user: { connect: { id: "user_1" } },
      organization: { connect: { id: "org_1" } },
    };
    prisma.membership.create.mockResolvedValue({ id: "m_1" });
    await repository.create(createData as never);
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: createData,
    });

    prisma.membership.findUnique.mockResolvedValue({ id: "m_1" });
    await repository.findById("m_1");
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { id: "m_1" },
    });

    prisma.membership.update.mockResolvedValue({ id: "m_1", isActive: false });
    await repository.update("m_1", { isActive: false });
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: { isActive: false },
    });

    prisma.membership.delete.mockResolvedValue({ id: "m_1" });
    await repository.delete("m_1");
    expect(prisma.membership.delete).toHaveBeenCalledWith({
      where: { id: "m_1" },
    });
  });
});

describe("ClientRepository", () => {
  it("cobre CRUD basico", async () => {
    const prisma = createMockPrisma();
    const repository = new ClientRepository(prisma as never);

    const createData = {
      name: "Cliente 1",
      organization: { connect: { id: "org_1" } },
    };
    prisma.client.create.mockResolvedValue({ id: "c_1" });
    await repository.create(createData as never);
    expect(prisma.client.create).toHaveBeenCalledWith({
      data: createData,
    });

    prisma.client.findUnique.mockResolvedValue({ id: "c_1" });
    await repository.findById("c_1");
    expect(prisma.client.findUnique).toHaveBeenCalledWith({
      where: { id: "c_1" },
    });

    prisma.client.update.mockResolvedValue({ id: "c_1", name: "Cliente X" });
    await repository.update("c_1", { name: "Cliente X" });
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "c_1" },
      data: { name: "Cliente X" },
    });

    prisma.client.delete.mockResolvedValue({ id: "c_1" });
    await repository.delete("c_1");
    expect(prisma.client.delete).toHaveBeenCalledWith({
      where: { id: "c_1" },
    });
  });
});

describe("MetaConnectionRepository", () => {
  it("cobre CRUD basico", async () => {
    const prisma = createMockPrisma();
    const repository = new MetaConnectionRepository(prisma as never);

    const createData = {
      organization: { connect: { id: "org_1" } },
      accountId: "act_1",
    };
    prisma.metaConnection.create.mockResolvedValue({ id: "mc_1" });
    await repository.create(createData as never);
    expect(prisma.metaConnection.create).toHaveBeenCalledWith({
      data: createData,
    });

    prisma.metaConnection.findUnique.mockResolvedValue({ id: "mc_1" });
    await repository.findById("mc_1");
    expect(prisma.metaConnection.findUnique).toHaveBeenCalledWith({
      where: { id: "mc_1" },
    });

    prisma.metaConnection.update.mockResolvedValue({
      id: "mc_1",
      isActive: false,
    });
    await repository.update("mc_1", { isActive: false });
    expect(prisma.metaConnection.update).toHaveBeenCalledWith({
      where: { id: "mc_1" },
      data: { isActive: false },
    });

    prisma.metaConnection.delete.mockResolvedValue({ id: "mc_1" });
    await repository.delete("mc_1");
    expect(prisma.metaConnection.delete).toHaveBeenCalledWith({
      where: { id: "mc_1" },
    });
  });
});

describe("CampaignRepository", () => {
  it("cobre CRUD basico", async () => {
    const prisma = createMockPrisma();
    const repository = new CampaignRepository(prisma as never);

    const createData = {
      organization: { connect: { id: "org_1" } },
      externalId: "ext_1",
      name: "Campanha 1",
      snapshotDate: new Date("2026-02-26T00:00:00.000Z"),
    };
    prisma.campaign.create.mockResolvedValue({ id: "cp_1" });
    await repository.create(createData as never);
    expect(prisma.campaign.create).toHaveBeenCalledWith({
      data: createData,
    });

    prisma.campaign.findUnique.mockResolvedValue({ id: "cp_1" });
    await repository.findById("cp_1");
    expect(prisma.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: "cp_1" },
    });

    prisma.campaign.update.mockResolvedValue({
      id: "cp_1",
      name: "Campanha X",
    });
    await repository.update("cp_1", { name: "Campanha X" });
    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: "cp_1" },
      data: { name: "Campanha X" },
    });

    prisma.campaign.delete.mockResolvedValue({ id: "cp_1" });
    await repository.delete("cp_1");
    expect(prisma.campaign.delete).toHaveBeenCalledWith({
      where: { id: "cp_1" },
    });
  });
});
