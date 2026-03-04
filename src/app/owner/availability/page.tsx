"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { OwnerGate } from "@/components/owner/OwnerGate"
import { OwnerShell } from "@/components/owner/OwnerShell"
import { UIButton } from "@/components/ui/UIButton"
import { useOwnerAccess } from "@/lib/client/use-owner-access"

type ApiFailure = {
  success: false
  code: string
  message: string
  errors?: Array<{
    field?: string | number
    message: string
  }>
}

type ApiResult<T> = { success: true; data: T } | ApiFailure

type DaySchedule = {
  enabled: boolean
  start?: string
  end?: string
}

type WeeklySchedule = {
  monday?: DaySchedule
  tuesday?: DaySchedule
  wednesday?: DaySchedule
  thursday?: DaySchedule
  friday?: DaySchedule
  saturday?: DaySchedule
  sunday?: DaySchedule
}

type TeamMember = {
  userId: string
  role: "OWNER" | "BARBER"
  name: string
  email: string
  weeklySchedule: WeeklySchedule | null
}

const DAYS: Array<{ key: keyof WeeklySchedule; label: string }> = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terca" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
]

function resolveError(result: ApiFailure, fallback: string) {
  if (result.errors?.[0]?.message) return result.errors[0].message
  return result.message || fallback
}

function buildDefaultWeeklySchedule(): WeeklySchedule {
  return {
    monday: { enabled: true, start: "09:00", end: "19:00" },
    tuesday: { enabled: true, start: "09:00", end: "19:00" },
    wednesday: { enabled: true, start: "09:00", end: "19:00" },
    thursday: { enabled: true, start: "09:00", end: "19:00" },
    friday: { enabled: true, start: "09:00", end: "19:00" },
    saturday: { enabled: true, start: "09:00", end: "14:00" },
    sunday: { enabled: false },
  }
}

function normalizeWeeklySchedule(raw: WeeklySchedule | null | undefined): WeeklySchedule {
  const fallback = buildDefaultWeeklySchedule()
  if (!raw || typeof raw !== "object") {
    return fallback
  }

  const normalized: WeeklySchedule = {}
  for (const day of DAYS) {
    const value = raw[day.key]
    if (!value) {
      normalized[day.key] = fallback[day.key]
      continue
    }

    normalized[day.key] = {
      enabled: Boolean(value.enabled),
      ...(value.start ? { start: value.start } : {}),
      ...(value.end ? { end: value.end } : {}),
    }
  }

  return normalized
}

export default function OwnerAvailabilityPage() {
  const { state, error: accessError, token, ownerBarbershopId, barbershopStatus } = useOwnerAccess()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [schedule, setSchedule] = useState<WeeklySchedule>(buildDefaultWeeklySchedule())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const selectedMember = useMemo(
    () => members.find((item) => item.userId === selectedUserId) ?? null,
    [members, selectedUserId]
  )

  const loadMembers = useCallback(async () => {
    if (!token || !ownerBarbershopId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/barbers`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const result = (await response.json()) as ApiResult<TeamMember[]>
      if (!result.success) {
        setError(resolveError(result, "Falha ao carregar barbeiros para agenda."))
        return
      }

      setMembers(result.data)
      if (result.data.length > 0) {
        const preferred = result.data.find((item) => item.userId === selectedUserId) ?? result.data[0]
        setSelectedUserId(preferred.userId)
        setSchedule(normalizeWeeklySchedule(preferred.weeklySchedule))
      }
    } catch {
      setError("Falha de conexao ao carregar agenda da equipe.")
    } finally {
      setLoading(false)
    }
  }, [ownerBarbershopId, selectedUserId, token])

  useEffect(() => {
    if (state !== "ready") return
    void loadMembers()
  }, [state, loadMembers])

  useEffect(() => {
    if (!selectedMember) return
    setSchedule(normalizeWeeklySchedule(selectedMember.weeklySchedule))
  }, [selectedMember])

  async function handleSaveSchedule() {
    if (!token || !ownerBarbershopId || !selectedUserId) return

    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(
        `/api/barbers/${selectedUserId}/schedule?barbershopId=${ownerBarbershopId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            weeklySchedule: schedule,
          }),
        }
      )

      const result = (await response.json()) as ApiResult<{ userId: string }>
      if (!result.success) {
        setError(resolveError(result, "Falha ao salvar agenda do barbeiro."))
        return
      }

      setInfo("Agenda semanal atualizada com sucesso.")
      await loadMembers()
    } catch {
      setError("Falha de conexao ao salvar agenda.")
    } finally {
      setSaving(false)
    }
  }

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Disponibilidade"
        subtitle="Configure os horarios de atendimento da equipe."
        activePath="/owner/availability"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title="Disponibilidade"
      subtitle="Agenda semanal por barbeiro."
      activePath="/owner/availability"
      statusLabel={barbershopStatus}
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mb-4 rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
          {info}
        </p>
      ) : null}

      {members.length === 0 ? (
        <section className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4 text-sm text-[#c5cee9]">
          Nenhum barbeiro ativo encontrado para configurar agenda.
        </section>
      ) : (
        <section className="grid gap-4 rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4 lg:grid-cols-[280px,1fr]">
          <aside className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#aeb8db]">
              Barbeiros
            </h2>
            {members.map((member) => (
              <button
                key={member.userId}
                type="button"
                onClick={() => {
                  setSelectedUserId(member.userId)
                  setSchedule(normalizeWeeklySchedule(member.weeklySchedule))
                }}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  selectedUserId === member.userId
                    ? "border-[#f36c20]/65 bg-[#f36c20]/16 text-[#ffe4d6]"
                    : "border-white/12 bg-[#090f26]/75 text-[#c8d1ed] hover:border-white/25"
                }`}
              >
                <p className="font-semibold">{member.name}</p>
                <p className="text-xs text-[#aeb8db]">{member.email}</p>
                <p className="mt-1 text-[11px] text-[#9fb1e2]">{member.role}</p>
              </button>
            ))}
          </aside>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Agenda de {selectedMember?.name ?? "barbeiro"}
              </h2>
              <div className="flex gap-2">
                <UIButton type="button" variant="secondary" onClick={loadMembers} disabled={loading}>
                  {loading ? "Atualizando..." : "Recarregar"}
                </UIButton>
                <UIButton type="button" onClick={handleSaveSchedule} disabled={saving || !selectedUserId}>
                  {saving ? "Salvando..." : "Salvar agenda"}
                </UIButton>
              </div>
            </div>

            <div className="space-y-2">
              {DAYS.map((day) => {
                const dayValue = schedule[day.key] ?? { enabled: false }
                return (
                  <div
                    key={day.key}
                    className="grid items-center gap-3 rounded-xl border border-white/12 bg-[#090f26]/75 p-3 md:grid-cols-[130px,110px,1fr,1fr]"
                  >
                    <p className="font-medium">{day.label}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setSchedule((prev) => ({
                          ...prev,
                          [day.key]: {
                            ...(prev[day.key] ?? {}),
                            enabled: !dayValue.enabled,
                          },
                        }))
                      }
                      className={`rounded-lg border px-2 py-1 text-sm ${
                        dayValue.enabled
                          ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                          : "border-white/20 bg-white/5 text-[#d6def7]"
                      }`}
                    >
                      {dayValue.enabled ? "Ativo" : "Fechado"}
                    </button>
                    <input
                      type="time"
                      value={dayValue.start ?? ""}
                      disabled={!dayValue.enabled}
                      onChange={(event) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [day.key]: {
                            ...(prev[day.key] ?? { enabled: true }),
                            enabled: dayValue.enabled,
                            start: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2 text-[#f1f2f7] outline-none focus:border-[#3f77f5] disabled:opacity-50"
                    />
                    <input
                      type="time"
                      value={dayValue.end ?? ""}
                      disabled={!dayValue.enabled}
                      onChange={(event) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [day.key]: {
                            ...(prev[day.key] ?? { enabled: true }),
                            enabled: dayValue.enabled,
                            end: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2 text-[#f1f2f7] outline-none focus:border-[#3f77f5] disabled:opacity-50"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </OwnerShell>
  )
}

