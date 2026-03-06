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
  name: string
  email: string
  phone: string | null
  bio: string | null
  avatarUrl: string | null
  weeklySchedule: unknown
  hasBarberMembership: boolean
  canManageOwnBlocks: boolean
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

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
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

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [bio, setBio] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [savingName, setSavingName] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [savingBio, setSavingBio] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [canManageOwnBlocks, setCanManageOwnBlocks] = useState(false)
  const [blocks, setBlocks] = useState<BarberBlock[]>([])
  const [blockError, setBlockError] = useState<string | null>(null)
  const [savingBlock, setSavingBlock] = useState(false)
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null)
  const [blockDate, setBlockDate] = useState(getBusinessDateToday())
  const [blockAllDay, setBlockAllDay] = useState(false)
  const [blockStartTime, setBlockStartTime] = useState("09:00")
  const [blockEndTime, setBlockEndTime] = useState("10:00")
  const [blockReason, setBlockReason] = useState("")

  const avatarFallback = useMemo(() => getInitials(name || userName || "B"), [name, userName])

  const applyProfileData = useCallback((data: BarberProfileData) => {
    setName(data.name)
    setEmail(data.email)
    setPhone(formatPhone(data.phone ?? ""))
    setBio(data.bio ?? "")
    setAvatarUrl(data.avatarUrl ?? null)
    setCanManageOwnBlocks(data.canManageOwnBlocks)
  }, [])

  const loadData = useCallback(async () => {
    if (!token) return

    setError(null)
    setBlockError(null)

    try {
      const profileResponse = await fetch("/api/barbers/me/profile", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })

      const profileResult = await profileResponse.json() as ApiResult<BarberProfileData>
      if (!profileResult.success) {
        setError(resolveError(profileResult, "Falha ao carregar perfil."))
        return
      }

      applyProfileData(profileResult.data)

      if (!profileResult.data.canManageOwnBlocks || !userId || !barbershopId) {
        setBlocks([])
        return
      }

      const blocksResponse = await fetch(`/api/barbers/${userId}/profile?barbershopId=${barbershopId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })

      const blocksResult = await blocksResponse.json() as ApiResult<BarberBlock[]>
      if (!blocksResult.success) {
        setBlocks([])
        setBlockError(resolveError(blocksResult, "Sem permissão para gerenciar bloqueios."))
        return
      }

      setBlocks(blocksResult.data)
    } catch {
      setError("Falha de conexão ao carregar Configurações do perfil.")
    }
  }, [applyProfileData, barbershopId, token, userId])

  useEffect(() => {
    if (state !== "ready") return
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, loadData])

  const saveProfileSection = useCallback(async (payload: Record<string, unknown>, successMessage: string, fallbackError: string) => {
    if (!token) return false

    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/barbers/me/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json() as ApiResult<BarberProfileData>
      if (!result.success) {
        setError(resolveError(result, fallbackError))
        return false
      }

      applyProfileData(result.data)
      setSuccess(successMessage)
      return true
    } catch {
      setError("Falha de conexão ao atualizar perfil.")
      return false
    }
  }, [applyProfileData, token])

  async function saveNameSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingName(true)
    await saveProfileSection({ name }, "Nome atualizado com sucesso.", "Falha ao atualizar nome.")
    setSavingName(false)
  }

  async function saveEmailSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingEmail(true)
    await saveProfileSection({ email }, "Email atualizado com sucesso.", "Falha ao atualizar email.")
    setSavingEmail(false)
  }

  async function savePhoneSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPhone(true)
    await saveProfileSection({ phone }, "Telefone atualizado com sucesso.", "Falha ao atualizar telefone.")
    setSavingPhone(false)
  }

  async function saveBioSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingBio(true)
    await saveProfileSection({ bio }, "Bio atualizada com sucesso.", "Falha ao atualizar bio.")
    setSavingBio(false)
  }

  async function savePasswordSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPassword(true)

    const successResult = await saveProfileSection(
      {
        newPassword,
        confirmPassword,
      },
      "Senha atualizada com sucesso.",
      "Falha ao atualizar senha."
    )

    if (successResult) {
      setNewPassword("")
      setConfirmPassword("")
    }

    setSavingPassword(false)
  }

  async function saveAvatarSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return

    if (!avatarFile) {
      setError("Selecione uma imagem para atualizar o avatar.")
      return
    }

    setUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.set("file", avatarFile)

      const response = await fetch("/api/barbers/me/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const result = await response.json() as ApiResult<{ avatarUrl: string }>
      if (!result.success) {
        setError(resolveError(result, "Falha ao atualizar avatar."))
        return
      }

      setAvatarUrl(result.data.avatarUrl)
      setAvatarFile(null)
      setSuccess("Avatar atualizado com sucesso.")
    } catch {
      setError("Falha de conexão ao atualizar avatar.")
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !userId || !barbershopId || !canManageOwnBlocks) return

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

      const result = await response.json() as ApiResult<BarberBlock>
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
      setBlockError("Falha de conexão ao criar bloqueio.")
    } finally {
      setSavingBlock(false)
    }
  }

  async function removeBlock(blockId: string) {
    if (!token || !userId || !barbershopId || !canManageOwnBlocks) return

    setBlockError(null)
    setRemovingBlockId(blockId)

    try {
      const response = await fetch(`/api/barbers/${userId}/blocks/${blockId}?barbershopId=${barbershopId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json() as ApiResult<{ deleted: boolean }>
      if (!result.success) {
        setBlockError(resolveError(result, "Falha ao remover bloqueio."))
        return
      }

      setBlocks((prev) => prev.filter((item) => item.id !== blockId))
    } catch {
      setBlockError("Falha de conexão ao remover bloqueio.")
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
      subtitle="Configurações separadas para dados pessoais, contato, senha, bio e avatar."
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

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <h2 className="text-lg font-semibold">Avatar</h2>
          <form className="mt-4 space-y-3" onSubmit={saveAvatarSection}>
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-16 w-16 rounded-full border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-[#131d49] text-sm font-semibold text-[#dbe4ff]">
                  {avatarFallback}
                </div>
              )}

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="block w-full text-xs text-[#b4c0e7]"
                onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={uploadingAvatar}>
              {uploadingAvatar ? "Enviando..." : "Salvar avatar"}
            </UIButton>
          </form>
        </article>

        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <h2 className="text-lg font-semibold">Nome</h2>
          <form className="mt-4 space-y-3" onSubmit={saveNameSection}>
            <input
              className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingName}>
              {savingName ? "Salvando..." : "Salvar nome"}
            </UIButton>
          </form>
        </article>

        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <h2 className="text-lg font-semibold">Email</h2>
          <form className="mt-4 space-y-3" onSubmit={saveEmailSection}>
            <input
              type="email"
              className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              value={email}
              onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
              required
            />
            <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingEmail}>
              {savingEmail ? "Salvando..." : "Salvar email"}
            </UIButton>
          </form>
        </article>

        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
          <h2 className="text-lg font-semibold">Telefone</h2>
          <form className="mt-4 space-y-3" onSubmit={savePhoneSection}>
            <input
              className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              placeholder="(11) 99999-0000"
            />
            <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingPhone}>
              {savingPhone ? "Salvando..." : "Salvar telefone"}
            </UIButton>
          </form>
        </article>

        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4 xl:col-span-2">
          <h2 className="text-lg font-semibold">Bio</h2>
          <form className="mt-4 space-y-3" onSubmit={saveBioSection}>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-sm text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              maxLength={500}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Descreva seu estilo, especialidades e experiência."
            />
            <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingBio}>
              {savingBio ? "Salvando..." : "Salvar bio"}
            </UIButton>
          </form>
        </article>

        <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4 xl:col-span-2">
          <h2 className="text-lg font-semibold">Senha</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={savePasswordSection}>
            <label className="block">
              <span className="mb-1 block text-sm text-[#b8c3e6]">Nova senha</span>
              <input
                type="password"
                className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-[#b8c3e6]">Confirmar nova senha</span>
              <input
                type="password"
                className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
              />
            </label>
            <div className="sm:col-span-2">
              <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingPassword}>
                {savingPassword ? "Salvando..." : "Salvar senha"}
              </UIButton>
            </div>
          </form>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
        <h2 className="text-lg font-semibold">Bloqueios de agenda</h2>
        {!canManageOwnBlocks ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-[#091029]/75 p-3 text-sm text-[#c6d1ef]">
            Este recurso fica disponível apenas para barbeiros com permissão de bloqueio ou proprietários habilitados como barbeiro.
          </p>
        ) : (
          <>
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
                    <span className="mb-1 block text-sm text-[#b8c3e6]">Início</span>
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

              <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingBlock}>
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
                      <p className="text-sm font-semibold text-[#e9edff]">{formatBlockDate(block.date)}</p>
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
          </>
        )}
      </section>
    </BarberShell>
  )
}
