import { describe, expect, it } from "vitest";

import { chatPromptSchema } from "@/lib/validation/forms";

describe("chatPromptSchema", () => {
  it("accetta payload senza sessione", () => {
    const parsed = chatPromptSchema.safeParse({
      prompt: "Cosa mangiamo oggi?",
      sessionId: null,
      sourceSessionId: null,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.sessionId).toBeUndefined();
    expect(parsed.data.sourceSessionId).toBeUndefined();
    expect(parsed.data.saveMenu).toBe(false);
  });

  it("accetta sourceSessionId valido per modifiche menu", () => {
    const parsed = chatPromptSchema.safeParse({
      prompt: "Non ho le zucchine, modifica il menu",
      sourceSessionId: "56f35b70-0d3c-45f3-a7d9-d2f3256b30eb",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.sourceSessionId).toBe("56f35b70-0d3c-45f3-a7d9-d2f3256b30eb");
  });
});
