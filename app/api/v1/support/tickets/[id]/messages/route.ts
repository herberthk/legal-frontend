import { z } from "zod";
import { requireMobileAuth, requireMobileUser } from "@/lib/api/v1/guard";
import { getTicketMessages, addTicketMessage } from "@/lib/actions/support";
import { verifyDocOwnership } from "@/lib/api/v1/ownership";
import { COLLECTIONS } from "@/constants";
import { ok, badRequest, notFoundError } from "@/lib/api/v1/response";

/**
 * `GET  /api/v1/support/tickets/:id/messages` — the thread for one ticket.
 * `POST /api/v1/support/tickets/:id/messages` — appends a reply.
 *
 * Both first confirm the ticket belongs to the caller (`getTicketMessages` /
 * `addTicketMessage` take only a ticketId and carry no owner check) and 404 on a
 * foreign/unknown id.
 *
 * Security: on POST, `senderId` and `senderRole` are taken from the verified
 * user document — NEVER the body. `addTicketMessage` emails the customer when
 * `senderRole` is `ADMIN`/`SUPER_ADMIN`, so accepting a client-supplied role
 * would be a privilege escalation. A mobile customer always posts as their real
 * role (`USER`).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const owned = await verifyDocOwnership(COLLECTIONS.SUPPORT_TICKETS, id, gate.userId);
  if (!owned) return notFoundError("Ticket not found.");

  const messages = await getTicketMessages(id);
  return ok(messages);
}

const messageSchema = z.object({
  text: z.string().min(1).max(5000),
  attachments: z.array(z.string().url().max(2048)).max(10).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileUser(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const owned = await verifyDocOwnership(
    COLLECTIONS.SUPPORT_TICKETS,
    id,
    gate.user.id,
  );
  if (!owned) return notFoundError("Ticket not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await addTicketMessage(
    id,
    gate.user.id,
    gate.user.role,
    parsed.data.text,
    parsed.data.attachments ?? [],
  );
  return ok(result);
}
