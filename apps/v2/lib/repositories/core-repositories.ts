import type { Prisma, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";

type CorePrismaClient = Pick<
  PrismaClient,
  "organization" | "membership" | "client" | "metaConnection" | "campaign"
>;

export class OrganizationRepository {
  constructor(private readonly prisma: CorePrismaClient = getPrismaClient()) {}

  create(data: Prisma.OrganizationCreateInput) {
    return this.prisma.organization.create({ data });
  }

  findById(id: string) {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.organization.findMany({ orderBy: { createdAt: "desc" } });
  }

  update(id: string, data: Prisma.OrganizationUpdateInput) {
    return this.prisma.organization.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.organization.delete({ where: { id } });
  }
}

export class MembershipRepository {
  constructor(private readonly prisma: CorePrismaClient = getPrismaClient()) {}

  create(data: Prisma.MembershipCreateInput) {
    return this.prisma.membership.create({ data });
  }

  findById(id: string) {
    return this.prisma.membership.findUnique({ where: { id } });
  }

  findByUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  findByOrganization(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  update(id: string, data: Prisma.MembershipUpdateInput) {
    return this.prisma.membership.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.membership.delete({ where: { id } });
  }
}

export class ClientRepository {
  constructor(private readonly prisma: CorePrismaClient = getPrismaClient()) {}

  create(data: Prisma.ClientCreateInput) {
    return this.prisma.client.create({ data });
  }

  findById(id: string) {
    return this.prisma.client.findUnique({ where: { id } });
  }

  findByOrganization(organizationId: string) {
    return this.prisma.client.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  update(id: string, data: Prisma.ClientUpdateInput) {
    return this.prisma.client.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.client.delete({ where: { id } });
  }
}

export class MetaConnectionRepository {
  constructor(private readonly prisma: CorePrismaClient = getPrismaClient()) {}

  create(data: Prisma.MetaConnectionCreateInput) {
    return this.prisma.metaConnection.create({ data });
  }

  findById(id: string) {
    return this.prisma.metaConnection.findUnique({ where: { id } });
  }

  findByOrganization(organizationId: string) {
    return this.prisma.metaConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  update(id: string, data: Prisma.MetaConnectionUpdateInput) {
    return this.prisma.metaConnection.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.metaConnection.delete({ where: { id } });
  }
}

export class CampaignRepository {
  constructor(private readonly prisma: CorePrismaClient = getPrismaClient()) {}

  create(data: Prisma.CampaignCreateInput) {
    return this.prisma.campaign.create({ data });
  }

  findById(id: string) {
    return this.prisma.campaign.findUnique({ where: { id } });
  }

  findByOrganization(organizationId: string) {
    return this.prisma.campaign.findMany({
      where: { organizationId },
      orderBy: [{ snapshotDate: "desc" }, { createdAt: "desc" }],
    });
  }

  update(id: string, data: Prisma.CampaignUpdateInput) {
    return this.prisma.campaign.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.campaign.delete({ where: { id } });
  }
}
