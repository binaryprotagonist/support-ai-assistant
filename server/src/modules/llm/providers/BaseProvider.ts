import { LLMProvider, LLMRequest } from "../types.js";

export abstract class BaseProvider implements LLMProvider {
  public abstract readonly name: string;
  public abstract readonly defaultModel: string;

  public abstract generate(
    request: LLMRequest,
    signal?: AbortSignal
  ): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    model: string;
  }>;

  protected createTimeoutSignal(timeoutMs?: number, externalSignal?: AbortSignal): {
    signal: AbortSignal;
    cleanup: () => void;
  } {
    const timeout = timeoutMs || 15000;

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`LLM Request timed out after ${timeout}ms`));
    }, timeout);

    if (externalSignal) {
      externalSignal.addEventListener("abort", () => {
        controller.abort(externalSignal.reason);
      });
    }

    return {
      signal: controller.signal,
      cleanup: () => clearTimeout(timeoutId)
    };
  }

  protected formatMessagesToPrompt(messages: LLMRequest["messages"]): string {
    return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
  }
}
