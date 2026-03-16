import { type AnamnesisSpecialtyInput } from "@/lib/anamnesis/specialties";

export type ParsedTemplatePayload = {
  name: string;
  specialty: AnamnesisSpecialtyInput;
  description: string | null;
  formSchema: Record<string, unknown>;
  isActive: boolean;
};

type ParseResult =
  | { ok: true; data: ParsedTemplatePayload }
  | { ok: false; status: number; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSpecialty(value: unknown): AnamnesisSpecialtyInput | null {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-\s]+/g, "_");

  if (normalized === "ESTETICA") return "ESTETICA";
  if (normalized === "PSICOLOGIA") return "PSICOLOGIA";
  if (normalized === "CLINICA_GERAL") return "CLINICA_GERAL";

  return null;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (normalized.length < 3) return null;

  return normalized;
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeIsActive(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "undefined") return true;
  return null;
}

function normalizeFormSchema(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function parseTemplatePayload(body: unknown): ParseResult {
  if (!isRecord(body)) {
    return {
      ok: false,
      status: 400,
      error: "Payload invalido. Envie um objeto JSON.",
    };
  }

  const name = normalizeName(body["name"]);
  if (!name) {
    return {
      ok: false,
      status: 400,
      error: "Campo name e obrigatorio e deve ter ao menos 3 caracteres.",
    };
  }

  const specialty = normalizeSpecialty(body["specialty"]);
  if (!specialty) {
    return {
      ok: false,
      status: 400,
      error:
        "Campo specialty invalido. Valores aceitos: ESTETICA, PSICOLOGIA, CLINICA_GERAL.",
    };
  }

  if (
    "description" in body &&
    body["description"] !== null &&
    typeof body["description"] !== "string"
  ) {
    return {
      ok: false,
      status: 400,
      error: "Campo description deve ser string ou null quando informado.",
    };
  }

  if (!("formSchema" in body)) {
    return {
      ok: false,
      status: 400,
      error: "Campo formSchema e obrigatorio.",
    };
  }

  const formSchema = normalizeFormSchema(body["formSchema"]);
  if (!formSchema) {
    return {
      ok: false,
      status: 400,
      error: "Campo formSchema deve ser um objeto JSON.",
    };
  }

  const isActive = normalizeIsActive(body["isActive"]);
  if (isActive === null) {
    return {
      ok: false,
      status: 400,
      error: "Campo isActive deve ser boolean quando informado.",
    };
  }

  return {
    ok: true,
    data: {
      name,
      specialty,
      description: normalizeDescription(body["description"]),
      formSchema,
      isActive,
    },
  };
}

export function parseSpecialtyFilter(value: string | null): AnamnesisSpecialtyInput | null {
  if (!value) return null;
  return normalizeSpecialty(value);
}
