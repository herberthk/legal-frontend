export * from './pawapay'

import { PawaPayClient } from './pawapay';

export const pawapay = new PawaPayClient({
  apiToken: process.env.PAWAPAY_API_TOKEN,
  environment: "sandbox", // 'production' for live
});