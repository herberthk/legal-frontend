"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateSystemConfig } from "@/lib/actions/admin/config";
import { toast } from "sonner";
import { Save, Loader2, DollarSign, Settings, ShieldAlert, Sparkles, MessageSquare, Mic, Phone, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ConfigForm({
  initialConfig,
  isSuperAdmin,
}: {
  initialConfig: SystemConfig;
  isSuperAdmin: boolean;
}) {
  const [config, setConfig] = useState<SystemConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    if (!isSuperAdmin) {
      toast.error("Unauthorized: Only Super Admins can update system settings.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await updateSystemConfig(config, initialConfig);
      if (res.success) {
        toast.success("System configuration updated successfully!");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update configuration");
      }
    } catch (error) {
      toast.error("An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (key: keyof SystemConfig, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  const handlePricingChange = (key: keyof SystemConfig["pricing"], value: string) => {
    setConfig({
      ...config,
      pricing: { ...config.pricing, [key]: parseFloat(value) || 0 },
    });
  };

  const handleFreeTierChange = (key: keyof SystemConfig["freeTier"], value: string) => {
    setConfig({
      ...config,
      freeTier: { ...config.freeTier, [key]: parseInt(value) || 0 },
    });
  };

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-4 md:w-[600px] mb-8">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="freetier">Free Tier</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-500" />
              General Information
            </CardTitle>
            <CardDescription>
              Basic system configuration and contact details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="supportEmail" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Support Email
                </Label>
                <Input
                  id="supportEmail"
                  value={config.supportEmail}
                  onChange={(e) => handleChange("supportEmail", e.target.value)}
                  disabled={!isSuperAdmin}
                  placeholder="support@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportPhone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Support Phone
                </Label>
                <Input
                  id="supportPhone"
                  value={config.supportPhone}
                  onChange={(e) => handleChange("supportPhone", e.target.value)}
                  disabled={!isSuperAdmin}
                  placeholder="+256000000000"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pricing" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Financial & Pricing Rates
            </CardTitle>
            <CardDescription>
              Set exchange rates and service pricing limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 p-4 rounded-lg border border-border">
              <h3 className="font-medium flex items-center gap-2">
                Currency Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exchangeRate">UGX to USD Exchange Rate</Label>
                  <Input
                    id="exchangeRate"
                    type="number"
                    value={config.exchangeRateUGXtoUSD}
                    onChange={(e) => handleChange("exchangeRateUGXtoUSD", parseFloat(e.target.value) || 0)}
                    disabled={!isSuperAdmin}
                  />
                  <p className="text-xs text-muted-foreground">Used for conversions when processing local mobile money payments.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Service Costs (in USD)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="voiceSessionPerMinute" className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-muted-foreground" />
                    Voice Session / Min
                  </Label>
                  <Input
                    id="voiceSessionPerMinute"
                    type="number"
                    step="0.01"
                    value={config.pricing.voiceSessionPerMinute}
                    onChange={(e) => handlePricingChange("voiceSessionPerMinute", e.target.value)}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textSessionPer1kTokens" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    Text Session / 1k Tokens
                  </Label>
                  <Input
                    id="textSessionPer1kTokens"
                    type="number"
                    step="0.001"
                    value={config.pricing.textSessionPer1kTokens}
                    onChange={(e) => handlePricingChange("textSessionPer1kTokens", e.target.value)}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentReviewPerPage">Document Review / Page</Label>
                  <Input
                    id="documentReviewPerPage"
                    type="number"
                    step="0.01"
                    value={config.pricing.documentReviewPerPage}
                    onChange={(e) => handlePricingChange("documentReviewPerPage", e.target.value)}
                    disabled={!isSuperAdmin}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="freetier" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Welcome & Free Tier Allowances
            </CardTitle>
            <CardDescription>
              Configure the initial allocation given to users upon sign up and their recurring limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="welcomeTextTokens">Welcome Text Tokens (One-time)</Label>
                <Input
                  id="welcomeTextTokens"
                  type="number"
                  value={config.freeTier.welcomeTextTokens}
                  onChange={(e) => handleFreeTierChange("welcomeTextTokens", e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freeDailyTextTokens">Daily Free Text Tokens</Label>
                <Input
                  id="freeDailyTextTokens"
                  type="number"
                  value={config.freeTier.freeDailyTextTokens}
                  onChange={(e) => handleFreeTierChange("freeDailyTextTokens", e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcomeVoiceSeconds">Welcome Voice Seconds</Label>
                <Input
                  id="welcomeVoiceSeconds"
                  type="number"
                  value={config.freeTier.welcomeVoiceSeconds}
                  onChange={(e) => handleFreeTierChange("welcomeVoiceSeconds", e.target.value)}
                  disabled={!isSuperAdmin}
                />
                <p className="text-xs text-muted-foreground">{Math.floor(config.freeTier.welcomeVoiceSeconds / 60)} minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="advanced" className="space-y-4">
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <ShieldAlert className="w-5 h-5" />
              System Status
            </CardTitle>
            <CardDescription>
              Critical controls that affect the availability of the entire application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-red-700 dark:text-red-400 font-semibold">Maintenance Mode</Label>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Enable this to temporarily restrict all non-admin users from accessing the system.
                </p>
              </div>
              <Switch
                checked={config.maintenanceMode}
                onCheckedChange={(val) => handleChange("maintenanceMode", val)}
                disabled={!isSuperAdmin}
                className="data-[state=checked]:bg-red-500"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <div className="mt-8 flex justify-end gap-4">
        <Button 
          variant="outline" 
          onClick={() => setConfig(initialConfig)}
          disabled={!isSuperAdmin || isSaving}
        >
          Discard Changes
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={!isSuperAdmin || isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Config
        </Button>
      </div>
    </Tabs>
  );
}
