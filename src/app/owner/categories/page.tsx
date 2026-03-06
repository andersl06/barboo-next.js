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

type CategoryItem = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

type CategoryDraft = {
  name: string
  description: string
  isActive: boolean
}

function resolveError(result: ApiFailure, fallback: string) {
  if (result.errors?.[0]?.message) return result.errors[0].message
  return result.message || fallback
}

export default function OwnerCategoriesPage() {
  const { state, error: accessError, token, ownerBarbershopId, barbershopStatus } = useOwnerAccess()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, CategoryDraft>>({})
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const activeCount = useMemo(
    () => categories.filter((item) => item.isActive).length,
    [categories]
  )

  const loadCategories = useCallback(async () => {
    if (!token || !ownerBarbershopId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/categories?includeInactive=true`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const result = (await response.json()) as ApiResult<CategoryItem[]>
      if (!result.success) {
        setError(resolveError(result, "Falha ao carregar categorias."))
        return
      }

      setCategories(result.data)
      setDrafts(
        Object.fromEntries(
          result.data.map((item) => [
            item.id,
            {
              name: item.name,
              description: item.description ?? "",
              isActive: item.isActive,
            },
          ])
        )
      )
    } catch {
      setError("Falha de conexão ao carregar categorias.")
    } finally {
      setLoading(false)
    }
  }, [ownerBarbershopId, token])

  useEffect(() => {
    if (state !== "ready") return
    void loadCategories()
  }, [state, loadCategories])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !ownerBarbershopId) return

    setCreating(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
        }),
      })

      const result = (await response.json()) as ApiResult<CategoryItem>
      if (!result.success) {
        setError(resolveError(result, "Falha ao criar categoria."))
        return
      }

      setNewName("")
      setNewDescription("")
      setInfo("Categoria criada com sucesso.")
      await loadCategories()
    } catch {
      setError("Falha de conexão ao criar categoria.")
    } finally {
      setCreating(false)
    }
  }

  async function handleSave(categoryId: string) {
    if (!token || !ownerBarbershopId) return
    const draft = drafts[categoryId]
    if (!draft) return

    setSavingId(categoryId)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/categories/${categoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description || undefined,
          isActive: draft.isActive,
        }),
      })

      const result = (await response.json()) as ApiResult<CategoryItem>
      if (!result.success) {
        setError(resolveError(result, "Falha ao atualizar categoria."))
        return
      }

      setInfo("Categoria atualizada com sucesso.")
      await loadCategories()
    } catch {
      setError("Falha de conexão ao atualizar categoria.")
    } finally {
      setSavingId(null)
    }
  }

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Categorias"
        subtitle="Organize o catalogo com grupos de Serviços."
        activePath="/owner/categories"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title="Categorias"
      subtitle={`Total: ${categories.length} | Ativas: ${activeCount}`}
      activePath="/owner/categories"
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
        <h2 className="text-lg font-semibold">Nova categoria</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ex: Cortes"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Descrição</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Opcional"
            />
          </label>
        </div>
        <div className="mt-3">
          <UIButton type="submit" disabled={creating}>
            {creating ? "Criando..." : "Criar categoria"}
          </UIButton>
        </div>
      </form>

      <section className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Categorias cadastradas</h2>
          <UIButton type="button" variant="secondary" onClick={loadCategories} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar lista"}
          </UIButton>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4 text-sm text-[#c5cee9]">
            Nenhuma categoria cadastrada.
          </div>
        ) : (
          <div className="grid gap-3">
            {categories.map((item) => {
              const draft = drafts[item.id]
              if (!draft) return null
              return (
                <article key={item.id} className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={draft.name}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Descrição</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={draft.description}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, description: event.target.value },
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
                          [item.id]: { ...draft, isActive: !draft.isActive },
                        }))
                      }
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        draft.isActive
                          ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                          : "border-amber-300/35 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      {draft.isActive ? "Ativa" : "Inativa"}
                    </button>
                    <UIButton
                      type="button"
                      onClick={() => {
                        void handleSave(item.id)
                      }}
                      disabled={savingId === item.id}
                    >
                      {savingId === item.id ? "Salvando..." : "Salvar alteracoes"}
                    </UIButton>
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

