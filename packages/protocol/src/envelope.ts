import { z } from "zod";

export const EnvelopeKindSchema = z.enum(["req", "res", "ev"]);
export type EnvelopeKind = z.infer<typeof EnvelopeKindSchema>;

export const EnvelopeSchema = z.object({
  id: z.string().min(1),
  kind: EnvelopeKindSchema,
  type: z.string().min(1),
  payload: z.unknown(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

export function makeRequest(type: string, payload: unknown, id = crypto.randomUUID()): Envelope {
  return { id, kind: "req", type, payload };
}

export function makeResponse(id: string, type: string, payload: unknown): Envelope {
  return { id, kind: "res", type, payload };
}

export function makeEvent(type: string, payload: unknown, id = crypto.randomUUID()): Envelope {
  return { id, kind: "ev", type, payload };
}

export const ErrorPayloadSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;
