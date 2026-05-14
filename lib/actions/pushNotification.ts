"use server";
import { SINGLE_PUSH_NOTIFICATION_URL } from "@/constants";

type NotificationPayload = {
  to: string;
  message: string;
  link: string;
  title: string;
  imageUrl?: string;
};

interface ResponseData {
  success: boolean;
  message: string;
}

export const sendSingleNotification = async ({
  to,
  message,
  link,
  title,
  imageUrl,
}: NotificationPayload) => {
  try {
    const res = await fetch(SINGLE_PUSH_NOTIFICATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        message,
        link,
        title,
        imageUrl,
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      const errObj = {
        status: res.status,
        statusText: res.statusText,
        body: errorBody,
      };
      const err = new Error("API Error");
      err.message = JSON.stringify(errObj);
      throw err;
    }
    const response = (await res.json()) as ResponseData;
    console.log("Notification", response);
    return response;
  } catch (error) {
    console.log("Could not send notification single", error);
    return error;
  }
};
