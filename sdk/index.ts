export * from './pawapay'

import { PawaPayClient } from './pawapay';
// import "server-only";                  // Build-time guard: import fails on client
import { getSsentezoWallet, withSsentezo, SsentezoActionResult, handleSsentezoRouteError, parseCallbackPayload  } from "./ssentezo";
export {getSsentezoWallet, withSsentezo, type SsentezoActionResult, handleSsentezoRouteError, parseCallbackPayload}
export const wallet = getSsentezoWallet();

export const pawapay = new PawaPayClient({
  apiToken: process.env.PAWAPAY_API_TOKEN,
  environment: "sandbox", // 'production' for live
});