import "server-only";                  // Build-time guard: import fails on client
import { getSsentezoWallet } from "./ssentezo";

export const wallet = getSsentezoWallet();