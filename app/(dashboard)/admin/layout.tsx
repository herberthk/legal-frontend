import { getCurrentUser } from "@/lib";
import { notFound, redirect } from "next/navigation";
import React from "react";

const layout = async({ children }: { children: React.ReactNode }) => {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  // Throw page not found if user is not admin
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return notFound();

  return <>{children}</>;
};

export default layout;