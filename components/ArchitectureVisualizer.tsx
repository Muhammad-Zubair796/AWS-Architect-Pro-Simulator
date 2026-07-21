"use client";
import { Database, Server, Globe, Shield, ArrowRightLeft, DoorOpen, Lock, ArrowDown, ArrowUp } from "lucide-react";

export default function ArchitectureVisualizer({
  inputs,
  aliasMap,
  mode,
  scores
}: {
  inputs: { [key: string]: string },
  aliasMap: { [key: string]: string },
  mode: "cli" | "terraform",
  scores: { [key: string]: number }
}) {
  const isTF = mode === "terraform";

  const hasResource = (expectedName: string) => {
    if (isTF) {
      const tfMap: Record<string, string> = {
        "PUB_SUB_1": "tf-2-1", "PUB_SUB_2": "tf-2-6",
        "PRI_SUB_1": "tf-2-11", "PRI_SUB_2": "tf-2-16",
        "DB_SUB_1": "tf-2-21", "DB_SUB_2": "tf-2-26",
        "IGW": "tf-3-1", "PUB_RT": "tf-3-11", "NAT": "tf-6-4", "PRI_RT": "tf-6-15",
        "ALB_SG": "tf-4-1", "APP_SG": "tf-4-11", "DB_SG": "tf-4-21",
        "RDS": "tf-5-5", "ALB": "tf-8-7", "ASG": "tf-9-27"
      };
      return scores[tfMap[expectedName]] === 1;
    } else {
      const cliMap: Record<string, string> = {
        "PUB_SUB_1": "cli-2-1", "PUB_SUB_2": "cli-2-2",
        "PRI_SUB_1": "cli-2-3", "PRI_SUB_2": "cli-2-4",
        "DB_SUB_1": "cli-2-5", "DB_SUB_2": "cli-2-6",
        "IGW": "cli-3-1", "PUB_RT": "cli-3-9", "NAT": "cli-6-2", "PRI_RT": "cli-6-13",
        "ALB_SG": "cli-4-1", "APP_SG": "cli-4-2", "DB_SG": "cli-4-3",
        "RDS": "cli-5-5", "ALB": "cli-8-8", "ASG": "cli-9-23"
      };
      return scores[cliMap[expectedName]] === 1;
    }
  };

  const vpcCreated = isTF ? scores["tf-1-4"] === 1 : scores["cli-1-1"] === 1;
  
  const hasAzA = hasResource("PUB_SUB_1") || hasResource("PRI_SUB_1") || hasResource("DB_SUB_1");
  const hasAzB = hasResource("PUB_SUB_2") || hasResource("PRI_SUB_2") || hasResource("DB_SUB_2");

  const getName = (def: string) => {
    if (isTF) {
      const tfNames: Record<string, string> = {
        "VPC": "enterprise_vpc", "PUB_SUB_1": "public_subnet_1", "PUB_SUB_2": "public_subnet_2",
        "PRI_SUB_1": "private_app_subnet_1", "PRI_SUB_2": "private_app_subnet_2",
        "DB_SUB_1": "private_db_subnet_1", "DB_SUB_2": "private_db_subnet_2"
      };
      return aliasMap[tfNames[def]] || tfNames[def] || def;
    } else {
      const cliNames: Record<string, string> = {
        "VPC": "VPC_ID"
      };
      const lookup = cliNames[def] || def;
      return aliasMap[lookup] || lookup;
    }
  };

  // --- DYNAMIC REGION & AZ EXTRACTION ---
  const getAzA = () => {
    if (isTF) {
      const match = inputs["tf-2-4"]?.match(/availability_zone\s*=\s*"([^"]+)"/);
      return match ? match[1] : "us-east-1a";
    } else {
      const match = inputs["cli-2-1"]?.match(/--availability-zone\s+([a-z0-9-]+)/);
      return match ? match[1] : "us-east-1a";
    }
  };

  const getAzB = () => {
    if (isTF) {
      const match = inputs["tf-2-9"]?.match(/availability_zone\s*=\s*"([^"]+)"/);
      return match ? match[1] : "us-east-1b";
    } else {
      const match = inputs["cli-2-2"]?.match(/--availability-zone\s+([a-z0-9-]+)/);
      return match ? match[1] : "us-east-1b";
    }
  };

  const getRegion = () => {
    if (isTF) {
      const match = inputs["tf-1-2"]?.match(/region\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    }
    // For CLI, derive region from AZ A (strip the last letter if it exists)
    const azA = getAzA();
    const regionMatch = azA.match(/^([a-z]{2}-[a-z]+-\d+)[a-z]?$/);
    return regionMatch ? regionMatch[1] : "us-east-1";
  };
  // --------------------------------------

  return (
    <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 font-sans relative overflow-hidden">
      {/* AWS Cloud Outer Box */}
      <div className="absolute top-2 left-4 text-slate-600 font-bold text-xs flex items-center gap-1">
        ☁️ AWS Cloud ({getRegion()})
      </div>

      {/* Internet Traffic Arrow */}
      {hasResource("IGW") && (
        <div className="absolute top-0 right-16 flex flex-col items-center animate-in fade-in duration-1000">
          <span className="text-[10px] text-blue-400 font-bold">Internet</span>
          <ArrowDown className="w-4 h-4 text-blue-500 animate-bounce" />
        </div>
      )}

      {vpcCreated ? (
        <div className="mt-6 border-2 border-blue-500/50 bg-blue-950/10 rounded-xl p-4 relative animate-in zoom-in-95 duration-500">
          {/* VPC Label */}
          <div className="absolute -top-3 left-4 bg-slate-950 px-2 text-blue-400 font-bold text-xs flex items-center gap-1 border border-blue-500/50 rounded z-20">
            VPC (The Land): {getName("VPC")}
          </div>

          {/* IGW (Front Door) */}
          {hasResource("IGW") && (
            <div className="absolute -top-4 right-8 bg-emerald-900 border-2 border-emerald-500 text-emerald-300 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-20">
              <DoorOpen className="w-4 h-4" /> IGW (Front Door)
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-6">
            {/* AZ A */}
            {hasAzA && (
              <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-lg p-4 pt-8 flex flex-col gap-6 relative mt-4">
                {/* FIXED Z-INDEX FOR AZ LABEL */}
                <div className="absolute -top-3 left-0 right-0 flex justify-center z-10">
                  <span className="bg-slate-950 px-3 py-0.5 text-slate-400 text-[10px] uppercase tracking-widest border border-slate-700 rounded-full">
                    AZ: {getAzA()}
                  </span>
                </div>
                
                {/* Public Subnet 1 */}
                {hasResource("PUB_SUB_1") && (
                  <div className={`border-2 ${hasResource("ALB_SG") ? 'border-emerald-500' : 'border-emerald-900 border-dashed'} bg-emerald-950/20 rounded p-2 relative animate-in fade-in z-10`}>
                    {/* Arrow from IGW to Lobby */}
                    {hasResource("PUB_RT") && (
                      <div className="absolute -top-6 right-4 flex flex-col items-center text-emerald-500">
                        <ArrowDown className="w-4 h-4 animate-pulse" />
                      </div>
                    )}
                    <div className="text-[10px] text-emerald-500 font-bold mb-2 flex justify-between">
                      <span>Lobby 1 ({getName("PUB_SUB_1")})</span>
                      {hasResource("ALB_SG") && <Shield className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <div className="flex gap-2">
                      {hasResource("NAT") && <div className="bg-slate-800 border border-slate-600 text-slate-300 text-[9px] px-2 py-1 rounded flex items-center gap-1"><ArrowRightLeft className="w-3 h-3 text-blue-400"/> NAT (Window)</div>}
                      {hasResource("ALB") && <div className="bg-indigo-900 border border-indigo-500 text-indigo-300 text-[9px] px-2 py-1 rounded flex items-center gap-1"><Globe className="w-3 h-3"/> ALB (Host)</div>}
                    </div>
                  </div>
                )}

                {/* Arrow from Lobby to Kitchen */}
                {hasResource("PUB_SUB_1") && hasResource("PRI_SUB_1") && hasResource("ALB") && hasResource("ASG") && (
                  <div className="absolute top-[85px] left-1/2 -translate-x-1/2 text-orange-500 z-0">
                    <ArrowDown className="w-5 h-5 animate-bounce" />
                  </div>
                )}

                {/* Arrow from Kitchen to NAT */}
                {hasResource("PRI_SUB_1") && hasResource("NAT") && hasResource("PRI_RT") && (
                  <div className="absolute top-[85px] left-1/4 text-blue-400 z-0">
                    <ArrowUp className="w-4 h-4 animate-pulse" />
                  </div>
                )}

                {/* Private App Subnet 1 */}
                {hasResource("PRI_SUB_1") && (
                  <div className={`border-2 ${hasResource("APP_SG") ? 'border-orange-500' : 'border-orange-900 border-dashed'} bg-orange-950/20 rounded p-2 relative animate-in fade-in z-10`}>
                    <div className="text-[10px] text-orange-500 font-bold mb-2 flex justify-between">
                      <span>Kitchen 1 ({getName("PRI_SUB_1")})</span>
                      {hasResource("APP_SG") && <Shield className="w-3 h-3 text-orange-400" />}
                    </div>
                    {hasResource("ASG") && <div className="bg-orange-900 border border-orange-500 text-orange-200 text-[9px] px-2 py-1 rounded flex items-center gap-1 w-fit"><Server className="w-3 h-3"/> EC2 Chef</div>}
                  </div>
                )}

                {/* Arrow from Kitchen to Vault */}
                {hasResource("PRI_SUB_1") && hasResource("DB_SUB_1") && hasResource("ASG") && hasResource("RDS") && (
                  <div className="absolute bottom-[85px] left-1/2 -translate-x-1/2 text-red-500 z-0">
                    <ArrowDown className="w-5 h-5 animate-bounce" />
                  </div>
                )}

                {/* Private DB Subnet 1 */}
                {hasResource("DB_SUB_1") && (
                  <div className={`border-2 ${hasResource("DB_SG") ? 'border-red-500' : 'border-red-900 border-dashed'} bg-red-950/20 rounded p-2 relative animate-in fade-in z-10`}>
                    <div className="text-[10px] text-red-500 font-bold mb-2 flex justify-between">
                      <span>Vault 1 ({getName("DB_SUB_1")})</span>
                      {hasResource("DB_SG") && <Shield className="w-3 h-3 text-red-400" />}
                    </div>
                    {hasResource("RDS") && <div className="bg-red-900 border border-red-500 text-red-200 text-[9px] px-2 py-1 rounded flex items-center gap-1 w-fit"><Database className="w-3 h-3"/> RDS Master Ledger</div>}
                  </div>
                )}
              </div>
            )}

            {/* AZ B */}
            {hasAzB && (
              <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-lg p-4 pt-8 flex flex-col gap-6 relative mt-4">
                {/* FIXED Z-INDEX FOR AZ LABEL */}
                <div className="absolute -top-3 left-0 right-0 flex justify-center z-10">
                  <span className="bg-slate-950 px-3 py-0.5 text-slate-400 text-[10px] uppercase tracking-widest border border-slate-700 rounded-full">
                    AZ: {getAzB()}
                  </span>
                </div>
                
                {/* Public Subnet 2 */}
                {hasResource("PUB_SUB_2") && (
                  <div className={`border-2 ${hasResource("ALB_SG") ? 'border-emerald-500' : 'border-emerald-900 border-dashed'} bg-emerald-950/20 rounded p-2 relative animate-in fade-in z-10`}>
                    {/* Arrow from IGW to Lobby */}
                    {hasResource("PUB_RT") && (
                      <div className="absolute -top-6 right-4 flex flex-col items-center text-emerald-500">
                        <ArrowDown className="w-4 h-4 animate-pulse" />
                      </div>
                    )}
                    <div className="text-[10px] text-emerald-500 font-bold mb-2 flex justify-between">
                      <span>Lobby 2 ({getName("PUB_SUB_2")})</span>
                      {hasResource("ALB_SG") && <Shield className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <div className="flex gap-2">
                      {hasResource("ALB") && <div className="bg-indigo-900 border border-indigo-500 text-indigo-300 text-[9px] px-2 py-1 rounded flex items-center gap-1"><Globe className="w-3 h-3"/> ALB (Host)</div>}
                    </div>
                  </div>
                )}

                {/* Arrow from Lobby to Kitchen */}
                {hasResource("PUB_SUB_2") && hasResource("PRI_SUB_2") && hasResource("ALB") && hasResource("ASG") && (
                  <div className="absolute top-[85px] left-1/2 -translate-x-1/2 text-orange-500 z-0">
                    <ArrowDown className="w-5 h-5 animate-bounce" />
                  </div>
                )}

                {/* Private App Subnet 2 */}
                {hasResource("PRI_SUB_2") && (
                  <div className={`border-2 ${hasResource("APP_SG") ? 'border-orange-500' : 'border-orange-900 border-dashed'} bg-orange-950/20 rounded p-2 relative animate-in fade-in z-10`}>
                    <div className="text-[10px] text-orange-500 font-bold mb-2 flex justify-between">
                      <span>Kitchen 2 ({getName("PRI_SUB_2")})</span>
                      {hasResource("APP_SG") && <Shield className="w-3 h-3 text-orange-400" />}
                    </div>
                    {hasResource("ASG") && <div className="bg-orange-900 border border-orange-500 text-orange-200 text-[9px] px-2 py-1 rounded flex items-center gap-1 w-fit"><Server className="w-3 h-3"/> EC2 Chef</div>}
                  </div>
                )}

                {/* Arrow from Kitchen to Vault */}
                {hasResource("PRI_SUB_2") && hasResource("DB_SUB_2") && hasResource("ASG") && hasResource("RDS") && (
                  <div className="absolute bottom-[85px] left-1/2 -translate-x-1/2 text-red-500 z-0">
                    <ArrowDown className="w-5 h-5 animate-bounce" />
                  </div>
                )}

                {/* Private DB Subnet 2 */}
                {hasResource("DB_SUB_2") && (
                  <div className={`border-2 ${hasResource("DB_SG") ? 'border-red-500' : 'border-red-900 border-dashed'} bg-red-950/20 rounded p-2 relative animate-in fade-in z-10`}>
                    <div className="text-[10px] text-red-500 font-bold mb-2 flex justify-between">
                      <span>Vault 2 ({getName("DB_SUB_2")})</span>
                      {hasResource("DB_SG") && <Shield className="w-3 h-3 text-red-400" />}
                    </div>
                    {hasResource("RDS") && <div className="bg-red-900 border border-red-500 text-red-200 text-[9px] px-2 py-1 rounded flex items-center gap-1 w-fit"><Database className="w-3 h-3"/> RDS Standby Ledger</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-48 mt-4 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 bg-slate-900/20">
          <Lock className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm font-bold">Awaiting Land Purchase (VPC)...</p>
        </div>
      )}
    </div>
  );
}//components\ArchitectureVisualizer.tsx