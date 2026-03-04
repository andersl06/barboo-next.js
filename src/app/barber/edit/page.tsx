"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { BarberGate } from "@/components/barber/BarberGate"
import { BarberShell } from "@/components/barber/BarberShell"
import { UIButton } from "@/components/ui/UIButton"
import { useBarberAccess } from "@/lib/client/use-barber-access"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiFailure = {
  success: false
  code: string
  message: string
  errors?: ApiErrorDetail[]
}

type ApiResult<T> = { success: true; data: T } | ApiFailure

type BarberProfileData = {
  userId: string
  bio: string | null
  avatarUrl: string | null
  weeklySchedule: unknown
}

type BarberBlock = {
  id: string
  date: string
  allDay: boolean
  startTime: string | null
  endTime: string | null
  reason: string | null
}

function getBusinessDateToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function resolveError(result: ApiFailure, fallback: string) {
  return result.errors?.[0]?.message ?? result.message ?? fallback
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function formatBlockDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value))
}

export default function BarberEditPage() {
  const {
    state,
    error: accessError,
    token,
    userId,
    userName,
    barbershopId,
    barbershopStatus,
  } = useBarberAccess()

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [blocks, setBlocks] = useState<BarberBlock[]>([])
  const [blockError, setBlockError] = useState<string | null>(null)
  const [savingBlock, setSavingBlock] = useState(false)
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null)
  const [blockDate, setBlockDate] = useState(getBusinessDateToday())
  const [blockAllDay, setBlockAllDay] = useState(false)
  const [blockStartTime, setBlockStartTime] = useState("09:00")
  const [blockEndTime, setBlockEndTime] = useState("10:00")
  const [blockReason, setBlockReason] = useState("")

  const avatarFallback = useMemo(() => getInitials(userName ?? "B"), [userName])

  const loadData = useCallback(async () => {
    if (!token || !userId || !barbershopId) return

    setError(null)
    setBlockError(null)

    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [profileResponse, blocksResponse] = await Promise.all([
        fetch("/api/barbers/me/profile", { headers, cache: "no-store" }),
        fetch(`/api/barbers/${userId}/profile?barbershopId=${barbershopId}`, {
          headers,
          cache: "no-store",
        }),
      ])

      const [profileResult, blocksResult] = await Promise.all([
        profileResponse.json() as Promise<ApiResult<BarberProfileData>>,
        blocksResponse.json() as Promise<ApiResult<BarberBlock[]>>,
      ])

      if (!profileResult.success) {
        setError(resolveError(profileResult, "Falha ao carregar perfil do barbeiro."))
        return
      }

      setBio(profileResult.data.bio ?? "")
      setAvatarUrl(profileResult.data.avatarUrl ?? null)

      if (!blocksResult.success) {
        setBlocks([])
        setBlockError(resolveError(blocksResult, "Sem permissao para gerenciar bloqueios."))
        return
      }

      setBlocks(blocksResult.data)
    } catch {
      setError("Falha de conexao ao carregar configuracoes do barbeiro.")
    }
  }, [barbershopId, token, userId])

  useEffect(() => {
    if (state !== "ready") return
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, loadData])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const profileResponse = await fetch("/api/barbers/me/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bio }),
      })

      const profileResult = (await profileResponse.json()) as ApiResult<BarberProfileData>
      if (!profileResult.success) {
        setError(resolveError(profileResult, "Falha ao atualizar bio."))
        return
      }

      if (avatarFile) {
        const formData = new FormData()
        formData.set("file", avatarFile)

        const avatarResponse = await fetch("/api/barbers/me/avatar", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        const avatarResult = (await avatarResponse.json()) as ApiResult<{ avatarUrl: string }>
        if (!avatarResult.success) {
          setError(resolveError(avatarResult, "Falha ao atualizar avatar."))
          return
        }

        setAvatarUrl(avatarResult.data.avatarUrl)
        setAvatarFile(null)
      }

      setSuccess("Perfil atualizado com sucesso.")
    } catch {
      setError("Falha de conexao ao atualizar perfil.")
    } finally {
      setLoading(false)
    }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !userId || !barbershopId) return

    setBlockError(null)

    if (!blockDate) {
      setBlockError("Informe a data do bloqueio.")
      return
    }

    if (!blockAllDay && (!blockStartTime || !blockEndTime)) {
      setBlockError("Informe hora inicial e final do bloqueio.")
      return
    }

    setSavingBlock(true)
    try {
      const response = await fetch(`/api/barbers/${userId}/profile?barbershopId=${barbershopId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: blockDate,
          allDay: blockAllDay,
          startTime: blockAllDay ? undefined : blockStartTime,
          endTime: blockAllDay ? undefined : blockEndTime,
          reason: blockReason.trim() || undefined,
        }),
      })

      const result = (await response.json()) as ApiResult<BarberBlock>
      if (!result.success) {
        setBlockError(resolveError(result, "Falha ao criar bloqueio."))
        return
      }

      setBlocks((prev) => [...prev, result.data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ))
      setBlockReason("")
      setSuccess("Bloqueio adicionado com sucesso.")
    } catch {
      setBlockError("Falha de conexao ao criar bloqueio.")
    } finally {
      setSavingBlock(false)
    }
  }

  async function removeBlock(blockId: string) {
    if (!token || !userId || !barbershopId) return

    setBlockError(null)
    setRemovingBlockId(blockId)

    try {
      const response = await fetch(`/api/barbers/${userId}/blocks/${blockId}?barbershopId=${barbershopId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<{ deleted: boolean }>
      if (!result.success) {
        setBlockError(resolveError(result, "Falha ao remover bloqueio."))
        return
      }

      setBlocks((prev) => prev.filter((item) => item.id !== blockId))
    } catch {
      setBlockError("Falha de conexao ao remover bloqueio.")
    } finally {
      setRemovingBlockId(null)
    }
  }

  if (state !== "ready") {
    return (
      <BarberShell
        title="Editar perfil"
        subtitle="Ajuste seu perfil e configure bloqueios de agenda."
        activePath="/barber/edit"
        statusLabel={barbershopStatus}
      >
        <BarberGate state={state} error={accessError} />
      </BarberShell>
    )
  }

  return (
    <BarberShell
      title="Editar perfil"
      subtitle="Atualize bio, avatar e bloqueios de disponibilidade."
      activePath="/barber/edit"
      statusLabel={barbershopStatus}
    >
      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-3 rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
          {success}
        </p>
      ) : null}

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <h2 className="text-lg font-semibold">Perfil do barbeiro</h2>
          <form className="mt-4 space-y-4" onSubmit={saveProfile}>
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar do barbeiro"
                  className="h-14 w-14 rounded-full border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#131d49] text-sm font-semibold text-[#dbe4ff]">
                  {avatarFallback}
                </div>
              )}

              <label className="text-sm text-[#c6d1ef]">
                Atualizar avatar
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="mt-1 block w-full text-xs text-[#b4c0e7]"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm text-[#b8c3e6]">Bio</span>
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-sm text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                maxLength={500}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Descreva seu estilo, especialidades e experiencia."
              />
            </label>

            <UIButton
              type="submit"
              className="!w-auto !px-4 !py-2 !text-sm"
              disabled={loading}
            >
              {loading ? "Salvando..." : "Salvar perfil"}
            </UIButton>
          </form>
        </article>

        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <h2 className="text-lg font-semibold">Bloqueios de agenda</h2>
          {blockError ? (
            <p className="mt-3 rounded-xl border border-red-300/35 bg-red-500/12 px-3 py-2 text-sm text-red-100">
              {blockError}
            </p>
          ) : null}

          <form className="mt-4 grid gap-3" onSubmit={createBlock}>
            <label className="block">
              <span className="mb-1 block text-sm text-[#b8c3e6]">Data</span>
              <input
                type="date"
                value={blockDate}
                onChange={(event) => setBlockDate(event.target.value)}
                className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                required
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-[#c6d1ef]">
              <input
                type="checkbox"
                checked={blockAllDay}
                onChange={(event) => setBlockAllDay(event.target.checked)}
                className="h-4 w-4 rounded border-white/25 bg-[#0b153c]"
              />
              Bloqueio o dia inteiro
            </label>

            {!blockAllDay ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-sm text-[#b8c3e6]">Inicio</span>
                  <input
                    type="time"
                    value={blockStartTime}
                    onChange={(event) => setBlockStartTime(event.target.value)}
                    className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-[#b8c3e6]">Fim</span>
                  <input
                    type="time"
                    value={blockEndTime}
                    onChange={(event) => setBlockEndTime(event.target.value)}
                    className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                    required
                  />
                </label>
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-sm text-[#b8c3e6]">Motivo (opcional)</span>
              <input
                type="text"
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
                maxLength={200}
                className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                placeholder="Ex.: Atendimento externo"
              />
            </label>

            <UIButton
              type="submit"
              className="!w-auto !px-4 !py-2 !text-sm"
              disabled={savingBlock}
            >
              {savingBlock ? "Salvando..." : "Adicionar bloqueio"}
            </UIButton>
          </form>

          <div className="mt-5 grid gap-2">
            {blocks.length > 0 ? (
              blocks.map((block) => (
                <article
                  key={block.id}
                  className="rounded-xl border border-white/12 bg-[#091029]/90 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#e9edff]">
                      {formatBlockDate(block.date)}
                    </p>
                    <button
                      type="button"
                      className="rounded-lg border border-white/20 px-2.5 py-1 text-xs font-semibold text-[#d8e3ff] transition hover:bg-white/10"
                      onClick={() => void removeBlock(block.id)}
                      disabled={removingBlockId === block.id}
                    >
                      {removingBlockId === block.id ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-[#c8d2f2]">
                    {block.allDay
                      ? "Dia inteiro"
                      : `${block.startTime ?? "--"} - ${block.endTime ?? "--"}`}
                  </p>
                  {block.reason ? (
                    <p className="mt-1 text-xs text-[#9fb0dd]">Motivo: {block.reason}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0a122f]/70 p-4 text-sm text-[#c6d1ef]">
                Nenhum bloqueio cadastrado.
              </p>
            )}
          </div>
        </article>
      </section>
    </BarberShell>
  )
}

