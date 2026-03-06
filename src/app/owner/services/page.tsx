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
  isActive: boolean
}

type ServiceItem = {
  id: string
  categoryId: string | null
  name: string
  description: string | null
  priceCents: number
  durationMinutes: number
  isActive: boolean
}

type ServiceDraft = {
  categoryId: string
  name: string
  description: string
  price: string
  durationMinutes: string
  isActive: boolean
}

function resolveError(result: ApiFailure, fallback: string) {
  if (result.errors?.[0]?.message) return result.errors[0].message
  return result.message || fallback
}

function centsToPrice(value: number) {
  return (value / 100).toFixed(2).replace(".", ",")
}

function parsePriceToCents(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "")
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

export default function OwnerServicesPage() {
  const { state, error: accessError, token, ownerBarbershopId, barbershopStatus } = useOwnerAccess()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, ServiceDraft>>({})
  const [newCategoryId, setNewCategoryId] = useState("")
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [newDuration, setNewDuration] = useState("30")
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const activeCount = useMemo(
    () => services.filter((item) => item.isActive).length,
    [services]
  )

  const loadData = useCallback(async () => {
    if (!token || !ownerBarbershopId) return

    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [categoriesResponse, servicesResponse] = await Promise.all([
        fetch(`/api/barbershops/${ownerBarbershopId}/categories?includeInactive=true`, {
          headers,
          cache: "no-store",
        }),
        fetch(`/api/barbershops/${ownerBarbershopId}/services?includeInactive=true`, {
          headers,
          cache: "no-store",
        }),
      ])

      const categoriesResult = (await categoriesResponse.json()) as ApiResult<CategoryItem[]>
      const servicesResult = (await servicesResponse.json()) as ApiResult<ServiceItem[]>

      if (!categoriesResult.success) {
        setError(resolveError(categoriesResult, "Falha ao carregar categorias."))
        return
      }

      if (!servicesResult.success) {
        setError(resolveError(servicesResult, "Falha ao carregar Serviços."))
        return
      }

      setCategories(categoriesResult.data)
      setServices(servicesResult.data)
      setDrafts(
        Object.fromEntries(
          servicesResult.data.map((item) => [
            item.id,
            {
              categoryId: item.categoryId ?? "",
              name: item.name,
              description: item.description ?? "",
              price: centsToPrice(item.priceCents),
              durationMinutes: String(item.durationMinutes),
              isActive: item.isActive,
            },
          ])
        )
      )
    } catch {
      setError("Falha de conexão ao carregar Serviços.")
    } finally {
      setLoading(false)
    }
  }, [ownerBarbershopId, token])

  useEffect(() => {
    if (state !== "ready") return
    void loadData()
  }, [state, loadData])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !ownerBarbershopId) return

    const priceCents = parsePriceToCents(newPrice)
    const durationMinutes = Number(newDuration)
    if (priceCents === null) {
      setError("preço inválido.")
      return
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5) {
      setError("duração inválida. Informe ao menos 5 minutos.")
      return
    }

    setCreating(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: newCategoryId || undefined,
          name: newName,
          description: newDescription || undefined,
          priceCents,
          durationMinutes,
        }),
      })

      const result = (await response.json()) as ApiResult<ServiceItem>
      if (!result.success) {
        setError(resolveError(result, "Falha ao criar Serviço."))
        return
      }

      setNewCategoryId("")
      setNewName("")
      setNewDescription("")
      setNewPrice("")
      setNewDuration("30")
      setInfo("Serviço criado com sucesso.")
      await loadData()
    } catch {
      setError("Falha de conexão ao criar Serviço.")
    } finally {
      setCreating(false)
    }
  }

  async function handleSave(serviceId: string) {
    if (!token || !ownerBarbershopId) return
    const draft = drafts[serviceId]
    if (!draft) return

    const priceCents = parsePriceToCents(draft.price)
    const durationMinutes = Number(draft.durationMinutes)
    if (priceCents === null) {
      setError("preço inválido.")
      return
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5) {
      setError("duração inválida. Informe ao menos 5 minutos.")
      return
    }

    setSavingId(serviceId)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/services/${serviceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: draft.categoryId || null,
          name: draft.name,
          description: draft.description || undefined,
          priceCents,
          durationMinutes,
          isActive: draft.isActive,
        }),
      })

      const result = (await response.json()) as ApiResult<ServiceItem>
      if (!result.success) {
        setError(resolveError(result, "Falha ao atualizar Serviço."))
        return
      }

      setInfo("Serviço atualizado com sucesso.")
      await loadData()
    } catch {
      setError("Falha de conexão ao atualizar Serviço.")
    } finally {
      setSavingId(null)
    }
  }

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Serviços"
        subtitle="Gerencie valores, duração e disponibilidade."
        activePath="/owner/services"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title="Serviços"
      subtitle={`Total: ${services.length} | Ativos: ${activeCount}`}
      activePath="/owner/services"
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
        <h2 className="text-lg font-semibold">Novo Serviço</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Categoria</span>
            <select
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newCategoryId}
              onChange={(event) => setNewCategoryId(event.target.value)}
            >
              <option value="">Sem categoria</option>
              {categories
                .filter((item) => item.isActive)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">preço (R$)</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newPrice}
              onChange={(event) => setNewPrice(event.target.value)}
              placeholder="35,00"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">duração (min)</span>
            <input
              type="number"
              min={5}
              step={5}
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={newDuration}
              onChange={(event) => setNewDuration(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 md:col-span-2">
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
            {creating ? "Criando..." : "Criar Serviço"}
          </UIButton>
        </div>
      </form>

      <section className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Serviços cadastrados</h2>
          <UIButton type="button" variant="secondary" onClick={loadData} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar lista"}
          </UIButton>
        </div>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4 text-sm text-[#c5cee9]">
            Nenhum Serviço cadastrado.
          </div>
        ) : (
          <div className="grid gap-3">
            {services.map((item) => {
              const draft = drafts[item.id]
              if (!draft) return null
              return (
                <article key={item.id} className="rounded-2xl border border-white/12 bg-[#0b1330]/82 p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Categoria</span>
                      <select
                        className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={draft.categoryId}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, categoryId: event.target.value },
                          }))
                        }
                      >
                        <option value="">Sem categoria</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">preço (R$)</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={draft.price}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, price: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">duração (min)</span>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={draft.durationMinutes}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, durationMinutes: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 md:col-span-2">
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
                      {draft.isActive ? "Ativo" : "Inativo"}
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

