"use server";
import { db } from "@/firebase/admin";

export const checkRootCollection = async (name: string) => {
  const collections = await db.listCollections();
  return collections.some((col) => col.id === name);
};
