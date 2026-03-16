"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  ANAMNESIS_SPECIALTIES,
  ANAMNESIS_SPECIALTY_LABEL,
  type AnamnesisSpecialtyInput,
} from "@/lib/anamnesis/specialties";
import styles from "./templates-manager.module.css";

type TemplateRecord = {
  id: string;
  tenantId: string;
  specialty: AnamnesisSpecialtyInput;
  name: string;
  description: string | null;
  formSchema: Record<string, unknown>;
  isActive: boolean;
  createdByUserId: string;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  data?: TemplateRecord | TemplateRecord[];
  error?: string;
};

const STARTER_SCHEMA: Record<AnamnesisSpecialtyInput, Record<string, unknown>> = {
  ESTETICA: {
    sections: [
      {
        title: "Historico Estetico",
        fields: [
          { key: "queixa_principal", type: "textarea", required: true },
          { key: "procedimentos_previos", type: "textarea", required: false },
          { key: "alergias", type: "checkbox-group", required: false },
        ],
      },
    ],
  },
  PSICOLOGIA: {
    sections: [
      {
        title: "Avaliacao Inicial",
        fields: [
          { key: "demanda_principal", type: "textarea", required: true },
          { key: "historico_familiar", type: "textarea", required: false },
          { key: "escala_humor", type: "number", required: false },
        ],
      },
    ],
  },
  CLINICA_GERAL: {
    sections: [
      {
        title: "Anamnese Clinica",
        fields: [
          { key: "sintomas_atuais", type: "textarea", required: true },
          { key: "medicacoes_em_uso", type: "textarea", required: false },
          { key: "doencas_cronicas", type: "checkbox-group", required: false },
        ],
      },
    ],
  },
};

function schemaToText(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function parseSchemaText(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("formSchema deve ser um objeto JSON.");
  }
  return parsed as Record<string, unknown>;
}

function readApiError(payload: ApiResponse, fallback: string): string {
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  return fallback;
}

type Notice = { type: "success" | "error"; message: string } | null;

export function TemplatesManager() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [specialtyFilter, setSpecialtyFilter] =
    useState<AnamnesisSpecialtyInput>("ESTETICA");
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [specialty, setSpecialty] =
    useState<AnamnesisSpecialtyInput>(specialtyFilter);
  const [formSchemaText, setFormSchemaText] = useState<string>(
    schemaToText(STARTER_SCHEMA[specialtyFilter]),
  );
  const [isActive, setIsActive] = useState<boolean>(true);

  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === editingId) ?? null,
    [templates, editingId],
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        specialty: specialtyFilter,
        includeInactive: includeInactive ? "true" : "false",
      });

      const response = await fetch(`/api/anamnesis/templates?${params.toString()}`, {
        method: "GET",
      });

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          readApiError(payload, "Nao foi possivel carregar os templates."),
        );
      }

      setTemplates(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar templates.";
      setNotice({ type: "error", message });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [specialtyFilter, includeInactive]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!editingId) {
      setSpecialty(specialtyFilter);
      setFormSchemaText(schemaToText(STARTER_SCHEMA[specialtyFilter]));
    }
  }, [editingId, specialtyFilter]);

  function startCreateMode(nextSpecialty: AnamnesisSpecialtyInput = specialtyFilter) {
    setEditingId(null);
    setName("");
    setDescription("");
    setSpecialty(nextSpecialty);
    setIsActive(true);
    setFormSchemaText(schemaToText(STARTER_SCHEMA[nextSpecialty]));
  }

  function startEditMode(template: TemplateRecord) {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description ?? "");
    setSpecialty(template.specialty);
    setIsActive(template.isActive);
    setFormSchemaText(schemaToText(template.formSchema));
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const parsedSchema = parseSchemaText(formSchemaText);
      const payload = {
        name,
        description,
        specialty,
        formSchema: parsedSchema,
        isActive,
      };

      const response = await fetch(
        editingId
          ? `/api/anamnesis/templates/${editingId}`
          : "/api/anamnesis/templates",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const responsePayload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          readApiError(responsePayload, "Nao foi possivel salvar o template."),
        );
      }

      setNotice({
        type: "success",
        message: editingId
          ? "Template atualizado com sucesso."
          : "Template criado com sucesso.",
      });

      if (!editingId) {
        startCreateMode(specialty);
      }

      await loadTemplates();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro inesperado ao salvar.";
      setNotice({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(template: TemplateRecord) {
    if (!window.confirm(`Arquivar template "${template.name}"?`)) {
      return;
    }

    setNotice(null);
    try {
      const response = await fetch(`/api/anamnesis/templates/${template.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          readApiError(payload, "Nao foi possivel arquivar o template."),
        );
      }

      if (editingId === template.id) {
        startCreateMode(template.specialty);
      }

      setNotice({ type: "success", message: "Template arquivado com sucesso." });
      await loadTemplates();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao arquivar template.";
      setNotice({ type: "error", message });
    }
  }

  async function handleToggleActive(template: TemplateRecord) {
    setNotice(null);
    try {
      const response = await fetch(`/api/anamnesis/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          readApiError(payload, "Nao foi possivel atualizar o status do template."),
        );
      }

      setNotice({
        type: "success",
        message: template.isActive
          ? "Template desativado."
          : "Template reativado.",
      });

      await loadTemplates();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro inesperado ao atualizar status.";
      setNotice({ type: "error", message });
    }
  }

  return (
    <section className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          {ANAMNESIS_SPECIALTIES.map((option) => (
            <button
              key={option}
              type="button"
              className={
                option === specialtyFilter ? styles.filterPillActive : styles.filterPill
              }
              onClick={() => setSpecialtyFilter(option)}
            >
              {ANAMNESIS_SPECIALTY_LABEL[option]}
            </button>
          ))}
        </div>

        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Mostrar inativos
        </label>
      </div>

      {notice ? (
        <p className={notice.type === "success" ? styles.noticeSuccess : styles.noticeError}>
          {notice.message}
        </p>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Templates</h2>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => startCreateMode()}
            >
              Novo
            </button>
          </div>

          {loading ? <p className={styles.muted}>Carregando templates...</p> : null}

          {!loading && templates.length === 0 ? (
            <p className={styles.muted}>
              Nenhum template encontrado para {ANAMNESIS_SPECIALTY_LABEL[specialtyFilter]}.
            </p>
          ) : null}

          <ul className={styles.templateList}>
            {templates.map((template) => (
              <li
                key={template.id}
                className={
                  editingId === template.id
                    ? `${styles.templateItem} ${styles.templateItemActive}`
                    : styles.templateItem
                }
              >
                <div className={styles.templateMeta}>
                  <strong>{template.name}</strong>
                  <span className={template.isActive ? styles.badgeActive : styles.badgeInactive}>
                    {template.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className={styles.templateDescription}>
                  {template.description || "Sem descricao"}
                </p>
                <p className={styles.templateDate}>
                  Atualizado em {formatDate(template.updatedAt)}
                </p>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => startEditMode(template)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => handleToggleActive(template)}
                  >
                    {template.isActive ? "Desativar" : "Reativar"}
                  </button>
                  <button
                    type="button"
                    className={styles.linkDanger}
                    onClick={() => handleArchive(template)}
                  >
                    Arquivar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>
            {editingTemplate ? "Editar Template" : "Novo Template"}
          </h2>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Nome</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={3}
                required
                placeholder="Ex: Anamnese Estetica Inicial"
              />
            </label>

            <label className={styles.field}>
              <span>Especialidade</span>
              <select
                value={specialty}
                onChange={(event) =>
                  setSpecialty(event.target.value as AnamnesisSpecialtyInput)
                }
              >
                {ANAMNESIS_SPECIALTIES.map((option) => (
                  <option value={option} key={option}>
                    {ANAMNESIS_SPECIALTY_LABEL[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Descricao</span>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Contexto rapido sobre o template."
              />
            </label>

            <label className={styles.field}>
              <span>Form Schema (JSON objeto)</span>
              <textarea
                rows={14}
                value={formSchemaText}
                onChange={(event) => setFormSchemaText(event.target.value)}
                className={styles.codeArea}
                required
              />
            </label>

            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Template ativo
            </label>

            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                {saving ? "Salvando..." : editingTemplate ? "Salvar alteracoes" : "Criar template"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => startCreateMode()}
              >
                Limpar
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
