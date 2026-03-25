"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";

/**
 * Updates the user's voice preference in Firestore
 * @param voicePreference - The name of the voice persona
 * @returns Object with success status and message
 */
export async function updateUserVoicePreference(
  voicePreference: string,
  userId: string,
) {
  try {
    const userDocRef = db.collection(COLLECTIONS.USERS).doc(userId);
    await userDocRef.update({
      voicePreference,
    });

    return {
      success: true,
      message: `Changed Voice preference to ${voicePreference}`,
    };
  } catch (error) {
    console.error("Error updating voice preference:", error);
    return {
      success: false,
      message: "Failed to update voice preference",
    };
  }
}
/**
 * Updates the user's basic profile information in Firestore
 * @param profileData - The data to update (name, avatar, etc.)
 * @param userId - The user's ID
 * @returns Object with success status and message
 */
export async function updateUserProfile(
  profileData: { name?: string; avatar?: string },
  userId: string,
) {
  try {
    const userDocRef = db.collection(COLLECTIONS.USERS).doc(userId);
    await userDocRef.update({
      ...profileData,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Profile updated successfully",
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      message: "Failed to update profile",
    };
  }
}
