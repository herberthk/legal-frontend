import { z } from "zod";
import { requireMobileAuth, requireMobileUser } from "@/lib/api/v1/guard";
import { createSupportTicket, getUserSupportTickets } from "@/lib/actions/support";
import { ok, badRequest, internalError } from "@/lib/api/v1/response";

/**
 * `GET  /api/v1/support/tickets` — the caller's tickets (newest first).
 * `POST /api/v1/support/tickets` — opens a ticket.
 *
 * On create, `userId`/`userName`/`email` are stamped from the verified user
 * document, never the request body — the client only supplies the complaint
 * fields. `getUserSupportTickets` already scopes its query to `userId`.
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const result = await getUserSupportTickets(gate.userId);
  if (!result.success) return internalError(result.error);
  return ok(result.tickets);
}

const createSchema = z.object({
  category: z.enum(["REFUND", "OVERCHARGE", "DOUBLE_CHARGE", "TECHNICAL", "OTHER"]),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  transactionId: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const gate = await requireMobileUser(req);
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await createSupportTicket({
    userId: gate.user.id,
    userName: gate.user.name,
    email: gate.user.email,
    category: parsed.data.category,
    subject: parsed.data.subject,
    description: parsed.data.description,
    priority: parsed.data.priority,
    ...(parsed.data.transactionId ? { transactionId: parsed.data.transactionId } : {}),
  });
  if (!result.success) return internalError(result.error || "Failed to create support ticket.");
  return ok(result);
}
