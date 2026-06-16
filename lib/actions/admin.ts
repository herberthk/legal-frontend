/**
 * Legacy re-export bridge.
 * The actual implementation has been split into:
 *   lib/actions/admin/auth.ts
 *   lib/actions/admin/users.ts
 *   lib/actions/admin/stats.ts
 *   lib/actions/admin/details.ts
 *
 * All existing imports from "@/lib/actions/admin" continue to work unchanged.
 */
export * from "./admin/index";
