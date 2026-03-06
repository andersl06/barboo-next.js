"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
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

type TeamMember = {
  userId: string
  role: "OWNER" | "BARBER"
  isActive: boolean
  canManageBlocks: boolean
  createdAt: string
  name: string
  email: string
  bio: string | null
  avatarUrl: string | null
  weeklySchedule: unknown
  profileCanManageBlocks: boolean
}

type MemberDraft = {
  name: string
  bio: string
  canManageBlocks: boolean
}

function resolveError(result: ApiFailure, fallback: string) {
  if (result.errors?.[0]?.message) return result.errors[0].message
  return result.message || fallback
}

export default function OwnerTeamPage() {
  const { state, error: accessError, token, ownerBarbershopId, barbershopStatus } = useOwnerAccess()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [drafts, setDrafts] = useState<Record<string, MemberDraft>>({})
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const activeMembers = useMemo(
    () => members.filter((item) => item.isActive).length,
    [members]
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
        setError(resolveError(result, "Falha ao carregar equipe."))
        return
      }

      setMembers(result.data)
      setDrafts(
        Object.fromEntries(
          result.data.map((item) => [
            item.userId,
            {
              name: item.name,
              bio: item.bio ?? "",
              canManageBlocks: item.canManageBlocks,
            },
          ])
        )
      )
    } catch {
      setError("Falha de conexão ao carregar equipe.")
    } finally {
      setLoading(false)
    }
  }, [ownerBarbershopId, token])

  useEffect(() => {
    if (state !== "ready") return
    void loadMembers()
  }, [state, loadMembers])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !ownerBarbershopId) return

    setCreating(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/barbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName || undefined,
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
        }),
      })

      const result = (await response.json()) as ApiResult<{ barber: { id: string } }>
      if (!result.success) {
        setError(resolveError(result, "Falha ao adicionar barbeiro."))
        return
      }

      setNewName("")
      setNewEmail("")
      setNewPassword("")
      setInfo("Barbeiro adicionado com sucesso.")
      await loadMembers()
    } catch {
      setError("Falha de conexão ao adicionar barbeiro.")
    } finally {
      setCreating(false)
    }
  }

  async function handleSave(member: TeamMember) {
    if (!token || !ownerBarbershopId) return
    const draft = drafts[member.userId]
    if (!draft) return

    setSavingId(member.userId)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/barbers/${member.userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: draft.name,
          bio: draft.bio,
          canManageBlocks: draft.canManageBlocks,
        }),
      })

      const result = (await response.json()) as ApiResult<TeamMember>
      if (!result.success) {
        setError(resolveError(result, "Falha ao atualizar barbeiro."))
        return
      }

      setInfo("Dados do barbeiro atualizados.")
      await loadMembers()
    } catch {
      setError("Falha de conexão ao atualizar barbeiro.")
    } finally {
      setSavingId(null)
    }
  }

  async function handleRemove(member: TeamMember) {
    if (!token || !ownerBarbershopId) return
    if (member.role !== "BARBER") return

    setRemovingId(member.userId)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/barbers/${member.userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<{ removed: boolean }>
      if (!result.success) {
        setError(resolveError(result, "Falha ao remover barbeiro."))
        return
      }

      setInfo("Barbeiro removido da barbearia.")
      await loadMembers()
    } catch {
      setError("Falha de conexão ao remover barbeiro.")
    } finally {
      setRemovingId(null)
    }
  }

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Equipe"
        subtitle="gestão completa de barbeiros da sua barbearia."
        activePath="/owner/team"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title="Equipe"
      subtitle={`Membros ativos: ${activeMembers}`}
      activePath="/owner/team"
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

      <form className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4" onSubmit={handleCreate}>
        <h2 className="text-lg font-semibold">Adicionar barbeiro</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome (opcional)</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">E-mail</span>
            <input
              type="email"
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Senha inicial</span>
            <input
              type="password"
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
        </div>
        <div className="mt-3">
          <UIButton type="submit" disabled={creating}>
            {creating ? "Adicionando..." : "Adicionar barbeiro"}
          </UIButton>
        </div>
      </form>

      <section className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Time atual</h2>
          <UIButton type="button" variant="secondary" onClick={loadMembers} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar equipe"}
          </UIButton>
        </div>

        {members.length === 0 ? (
          <div className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4 text-sm text-[#c5cee9]">
            Nenhum barbeiro encontrado.
          </div>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => {
              const draft = drafts[member.userId]
              if (!draft) return null
              return (
                <article key={member.userId} className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{member.email}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        member.role === "OWNER"
                          ? "border-[#f36c20]/50 bg-[#f36c20]/20 text-[#ffd9c8]"
                          : "border-[#6aa3ff]/35 bg-[#6aa3ff]/15 text-[#dbe8ff]"
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={draft.name}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [member.userId]: { ...draft, name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Bio</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={draft.bio}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [member.userId]: { ...draft, bio: event.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [member.userId]: {
                            ...draft,
                            canManageBlocks: !draft.canManageBlocks,
                          },
                        }))
                      }
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        draft.canManageBlocks
                          ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                          : "border-white/20 bg-white/5 text-[#d5def7]"
                      }`}
                    >
                      {draft.canManageBlocks ? "Pode bloquear agenda" : "Sem permissão de bloqueio"}
                    </button>

                    <UIButton
                      type="button"
                      onClick={() => {
                        void handleSave(member)
                      }}
                      disabled={savingId === member.userId}
                    >
                      {savingId === member.userId ? "Salvando..." : "Salvar alteracoes"}
                    </UIButton>

                    {member.role === "BARBER" ? (
                      <UIButton
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          void handleRemove(member)
                        }}
                        disabled={removingId === member.userId}
                      >
                        {removingId === member.userId ? "Removendo..." : "Remover da barbearia"}
                      </UIButton>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </OwnerShell>
  )
}

