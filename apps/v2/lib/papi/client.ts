import type { PapiEnv } from "@/lib/papi/env";

export type SendGroupMessageInput = {
  groupId: string;
  message: string;
};

export type SendGroupMessageResult = {
  status: number;
  ok: boolean;
  response: unknown;
};

export class PapiRequestError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "PapiRequestError";
    this.status = status;
    this.details = details;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const rawText = await response.text();
  if (rawText.length === 0) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

export class PapiClient {
  constructor(private readonly env: PapiEnv) {}

  async sendGroupMessage(input: SendGroupMessageInput): Promise<SendGroupMessageResult> {
    const groupId = input.groupId.trim();
    const message = input.message.trim();

    if (!groupId) {
      throw new Error("groupId obrigatorio para envio.");
    }

    if (!message) {
      throw new Error("message obrigatoria para envio.");
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.env.timeoutMs);

    const endpoint = `${this.env.baseUrl}${this.env.sendPath}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.env.apiKey,
          Authorization: `Bearer ${this.env.apiKey}`,
        },
        body: JSON.stringify({
          groupId,
          message,
        }),
        signal: abortController.signal,
      });

      const parsedBody = await parseResponseBody(response);

      if (!response.ok) {
        throw new PapiRequestError(
          `Falha ao enviar mensagem via Papi (${response.status})`,
          response.status,
          parsedBody,
        );
      }

      return {
        status: response.status,
        ok: true,
        response: parsedBody,
      };
    } catch (error) {
      if (error instanceof PapiRequestError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Timeout no envio Papi (${this.env.timeoutMs}ms).`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createPapiClient(env: PapiEnv): PapiClient {
  return new PapiClient(env);
}
