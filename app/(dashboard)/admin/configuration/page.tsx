import React from "react";
import { getSystemConfig } from "@/lib/actions/admin/config";
import { getCurrentUser } from "@/lib";
import { notFound } from "next/navigation";
import ConfigForm from "./ConfigForm";
import DirectionalTransition from "@/components/global/DirectionalTransition";

const ConfigurationPage = async () => {
  const user = await getCurrentUser();
  
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
    return notFound();
  }

  const { success, config, error } = await getSystemConfig();

  if (!success || !config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">
          Failed to load configuration: {error || "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <DirectionalTransition>
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">System Configuration</h2>
      </div>
      
      {user.role === "ADMIN" && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 p-4 rounded-md text-sm mb-4 border border-yellow-200 dark:border-yellow-900">
          You are viewing the system configuration in read-only mode. Only Super Admins can make changes.
        </div>
      )}

      <ConfigForm initialConfig={config} isSuperAdmin={user.role === "SUPER_ADMIN"} />
    </div>
    </DirectionalTransition>
  );
};

export default ConfigurationPage;