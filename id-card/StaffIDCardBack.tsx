"use client"

import { QRCodeSVG } from "qrcode.react"

interface StaffData { id?: string; firstName: string; lastName: string; staffId: string; role?: string; department?: string; phone?: string; email?: string; address?: string; qualification?: string; employmentDate?: string; gender?: string; emergencyContact?: string }
interface SchoolData { name: string; phone?: string; email?: string; address?: string }
interface IdCardConfig { backTitle?: string; showDepartment?: boolean; showEmergencyContact?: boolean; showRules?: boolean; rulesText?: string; customDepartment?: string; customEmergencyContact?: string; customFields?: { label: string; value: string }[] }
interface Props { staff: StaffData; school: SchoolData; config?: IdCardConfig; orientation?: "portrait" | "landscape" }

export function StaffIDCardBack({ staff, school, config, orientation = "portrait" }: Props) {
  const cfg = config || { backTitle: "Staff Information", showDepartment: true, showEmergencyContact: true, showRules: true, rulesText: "1. This card is the property of the school and must be returned upon request.\n2. Report lost or damaged cards immediately to the school office.\n3. This card is non-transferable and for official staff use only.\n4. Staff must present this card for identification and access purposes.\n5. Unauthorized modification of this card is prohibited.", customFields: [] }
  const qrData = JSON.stringify({ type: "staff", id: staff.id || staff.staffId, code: staff.staffId })

  if (orientation === "landscape") {
    return (
      <div className="w-[600px] rounded-2xl overflow-hidden shadow-xl border border-border/40 bg-white flex flex-row">
        <div className="relative bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white flex flex-col items-center justify-between min-h-[300px]" style={{ width: 220 }}>
          <div className="text-center">
            <p className="text-sm font-bold tracking-wide">{cfg.backTitle || "Staff Information"}</p>
          </div>
          <div className="bg-white rounded-lg p-1.5 border border-white/30">
            <QRCodeSVG value={qrData} size={90} level="M" />
          </div>
          <div className="text-center text-[9px] opacity-80">
            <p className="font-medium">{school.name}</p>
            {school.phone && <p>{school.phone}</p>}
          </div>
        </div>
        <div className="flex-1 p-5 flex flex-col">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {staff.qualification && <InfoRow label="Qualification" value={staff.qualification} />}
            {staff.employmentDate && <InfoRow label="Employed" value={new Date(staff.employmentDate).toLocaleDateString()} />}
            {staff.address && <InfoRow label="Address" value={staff.address} />}
            {cfg.showEmergencyContact && (cfg.customEmergencyContact || staff.emergencyContact) && <InfoRow label="Emergency" value={cfg.customEmergencyContact || staff.emergencyContact || ""} />}
            {(cfg.customFields || []).filter((f) => f.value).map((f, i) => <InfoRow key={i} label={f.label} value={f.value} />)}
          </div>
          {cfg.showRules && cfg.rulesText && (
            <div className="border-t border-gray-100 pt-2 mt-2">
              <p className="text-[7px] font-semibold text-amber-800 uppercase tracking-wider mb-1">Rules & Regulations</p>
              <pre className="text-[7px] text-amber-700 leading-relaxed whitespace-pre-wrap font-sans">{cfg.rulesText}</pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-[340px] rounded-2xl overflow-hidden shadow-xl border border-border/40 bg-white flex flex-col min-h-[480px]">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3.5 text-white text-center">
        <p className="text-sm font-bold tracking-wide">{cfg.backTitle || "Staff Information"}</p>
      </div>
      <div className="flex-1 p-5 space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {staff.qualification && <InfoRow label="Qualification" value={staff.qualification} />}
          {staff.employmentDate && <InfoRow label="Employed" value={new Date(staff.employmentDate).toLocaleDateString()} />}
          {staff.address && <InfoRow label="Address" value={staff.address} />}
          {cfg.showEmergencyContact && (cfg.customEmergencyContact || staff.emergencyContact) && <InfoRow label="Emergency" value={cfg.customEmergencyContact || staff.emergencyContact || ""} />}
          {(cfg.customFields || []).filter((f) => f.value).map((f, i) => <InfoRow key={i} label={f.label} value={f.value} />)}
        </div>
      </div>
      {cfg.showRules && cfg.rulesText && (
        <div className="px-5 py-2 border-t border-gray-100 bg-amber-50/50">
          <p className="text-[8px] font-semibold text-amber-800 uppercase tracking-wider mb-1 leading-normal">Rules & Regulations</p>
          <pre className="text-[7px] text-amber-700 leading-relaxed whitespace-pre-wrap font-sans">{cfg.rulesText}</pre>
        </div>
      )}
      <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="bg-white rounded-lg p-1 border border-gray-200 inline-block">
            <QRCodeSVG value={qrData} size={40} level="M" />
          </div>
          <p className="text-[8px] text-gray-400 mt-1 leading-normal">Scan QR</p>
        </div>
        <div className="text-[10px] text-gray-500 text-center leading-normal">
          <p className="font-semibold text-gray-700">{school.name}</p>
          {school.phone && <p>{school.phone}</p>}
          {school.email && <p className="text-[9px]">{school.email}</p>}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-normal">{label}</p>
      <p className="text-xs text-gray-700 leading-normal">{value}</p>
    </div>
  )
}
