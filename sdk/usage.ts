import { randomUUID } from "crypto";

const apiToken = "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjIyNzI4IiwibWF2IjoiMSIsImV4cCI6MjA5NjU0MjQ5NiwiaWF0IjoxNzgwOTIzMjk2LCJwbSI6IkRBRixQQUYiLCJqdGkiOiI5MTJlYjI3NS05ZGY4LTQ1MGYtYmY1Yy1lNDI4ZGRiMjNlYWIifQ.kS-dclKCW34SaBmEtZTue1TudtJ5nWw4SbIqPW3MS78ZxAp09oy95BhTuLv2sdXIzFRvhyjeuQnMOyKTaxhH4A";
const depositId = randomUUID(); // Store this before calling the API!

const response = await fetch("https://api.sandbox.pawapay.io/v2/deposits", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer "+apiToken,
  },
  body: JSON.stringify({
    depositId,
    amount: "150000",       // UGX, no decimals for Airtel
    currency: "UGX",
    payer: {
      type: "MMO",
      accountDetails: {
        phoneNumber: "256703752696", // Uganda country code: 256, no leading zero
        provider: "AIRTEL_OAPI_UGA", // or "MTN_MOMO_UGA"
      },
    },
  }),
});

const result = await response.json();
console.log(result); // "ACCEPTED", "REJECTED", or "DUPLICATE_IGNORED"