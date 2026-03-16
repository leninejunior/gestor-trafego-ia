export const ANAMNESIS_SPECIALTIES = [
  "ESTETICA",
  "PSICOLOGIA",
  "CLINICA_GERAL",
] as const;

export type AnamnesisSpecialtyInput = (typeof ANAMNESIS_SPECIALTIES)[number];

export const ANAMNESIS_SPECIALTY_LABEL: Record<
  AnamnesisSpecialtyInput,
  string
> = {
  ESTETICA: "Estetica",
  PSICOLOGIA: "Psicologia",
  CLINICA_GERAL: "Clinica Geral",
};
