import {
  parseSpecialtyFilter,
  parseTemplatePayload,
} from "@/lib/anamnesis/template-payload";

describe("template-payload", () => {
  it("normaliza specialty com variacoes de formato", () => {
    expect(parseSpecialtyFilter("estetica")).toBe("ESTETICA");
    expect(parseSpecialtyFilter("psicologia")).toBe("PSICOLOGIA");
    expect(parseSpecialtyFilter("clínica geral")).toBe("CLINICA_GERAL");
    expect(parseSpecialtyFilter("foo")).toBeNull();
  });

  it("aceita payload valido", () => {
    const parsed = parseTemplatePayload({
      name: "Template Inicial",
      specialty: "estetica",
      description: "Descricao curta",
      formSchema: { sections: [] },
      isActive: true,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.name).toBe("Template Inicial");
      expect(parsed.data.specialty).toBe("ESTETICA");
      expect(parsed.data.description).toBe("Descricao curta");
      expect(parsed.data.isActive).toBe(true);
    }
  });

  it("rejeita body nao objeto", () => {
    const parsed = parseTemplatePayload("invalido");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.status).toBe(400);
      expect(parsed.error).toContain("Payload invalido");
    }
  });

  it("rejeita description com tipo invalido", () => {
    const parsed = parseTemplatePayload({
      name: "Template Inicial",
      specialty: "ESTETICA",
      description: 10,
      formSchema: { sections: [] },
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.status).toBe(400);
      expect(parsed.error).toContain("description");
    }
  });

  it("rejeita formSchema ausente", () => {
    const parsed = parseTemplatePayload({
      name: "Template Inicial",
      specialty: "ESTETICA",
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.status).toBe(400);
      expect(parsed.error).toContain("formSchema");
    }
  });
});
