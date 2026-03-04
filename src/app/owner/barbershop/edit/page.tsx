"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
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

type BarbershopData = {
  id: string
  name: string
  description: string | null
  phone: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  slug: string | null
  cnpj: string | null
  status: string
  logoUrl: string | null
  coverUrl: string | null
}

type ZipData = {
  address: string
  neighborhood: string
  city: string
  state: string
}

type FormDataState = {
  name: string
  description: string
  phone: string
  address: string
  addressNumber: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  slug: string
  cnpj: string
}

function resolveError(result: ApiFailure, fallback: string) {
  if (result.errors?.[0]?.message) {
    return result.errors[0].message
  }
  return result.message || fallback
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

function formatZip(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
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

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

const EMPTY_FORM: FormDataState = {
  name: "",
  description: "",
  phone: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  slug: "",
  cnpj: "",
}

export default function OwnerBarbershopEditPage() {
  const {
    state,
    error: accessError,
    token,
    ownerBarbershopId,
    barbershopStatus,
  } = useOwnerAccess()

  const [loadingData, setLoadingData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingZip, setLoadingZip] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [shop, setShop] = useState<BarbershopData | null>(null)
  const [form, setForm] = useState<FormDataState>(EMPTY_FORM)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)

  const loadData = useCallback(async () => {
    if (!token || !ownerBarbershopId) return

    setLoadingData(true)
    setError(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const result = (await response.json()) as ApiResult<BarbershopData>
      if (!result.success) {
        setError(resolveError(result, "Falha ao carregar dados da barbearia."))
        return
      }

      setShop(result.data)
      setForm({
        name: result.data.name ?? "",
        description: result.data.description ?? "",
        phone: formatPhone(result.data.phone ?? ""),
        address: result.data.address ?? "",
        addressNumber: result.data.addressNumber ?? "",
        neighborhood: result.data.neighborhood ?? "",
        city: result.data.city ?? "",
        state: result.data.state ?? "",
        zipCode: formatZip(result.data.zipCode ?? ""),
        slug: result.data.slug ?? "",
        cnpj: formatCnpj(result.data.cnpj ?? ""),
      })
    } catch {
      setError("Falha de conexao ao carregar dados da barbearia.")
    } finally {
      setLoadingData(false)
    }
  }, [ownerBarbershopId, token])

  useEffect(() => {
    if (state !== "ready") return
    void loadData()
  }, [state, loadData])

  async function handleZipBlur() {
    const zip = onlyDigits(form.zipCode)
    if (zip.length !== 8) {
      return
    }

    setLoadingZip(true)
    try {
      const response = await fetch(`/api/utils/zip/${zip}`, { cache: "no-store" })
      const result = (await response.json()) as ApiResult<ZipData>
      if (!result.success) return

      setForm((prev) => ({
        ...prev,
        address: prev.address.trim().length > 0 ? prev.address : result.data.address,
        neighborhood:
          prev.neighborhood.trim().length > 0 ? prev.neighborhood : result.data.neighborhood,
        city: prev.city.trim().length > 0 ? prev.city : result.data.city,
        state: prev.state.trim().length > 0 ? prev.state : result.data.state,
      }))
    } finally {
      setLoadingZip(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !ownerBarbershopId) return

    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch(`/api/barbershops/${ownerBarbershopId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          phone: form.phone,
          address: form.address,
          addressNumber: form.addressNumber,
          neighborhood: form.neighborhood,
          city: form.city,
          state: form.state.toUpperCase(),
          zipCode: form.zipCode,
          slug: form.slug,
          cnpj: form.cnpj,
        }),
      })

      const result = (await response.json()) as ApiResult<BarbershopData>
      if (!result.success) {
        setError(resolveError(result, "Falha ao salvar dados da barbearia."))
        return
      }

      setInfo("Informacoes da barbearia atualizadas com sucesso.")
      await loadData()
    } catch {
      setError("Falha de conexao ao salvar dados da barbearia.")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(kind: "logo" | "cover") {
    if (!token || !ownerBarbershopId) return
    const file = kind === "logo" ? logoFile : coverFile
    if (!file) {
      setError(`Selecione um arquivo para ${kind === "logo" ? "logo" : "capa"}.`)
      return
    }

    if (kind === "logo") {
      setUploadingLogo(true)
    } else {
      setUploadingCover(true)
    }
    setError(null)
    setInfo(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`/api/barbershops/${ownerBarbershopId}/${kind}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const result = (await response.json()) as ApiResult<{ logoUrl?: string; coverUrl?: string }>
      if (!result.success) {
        setError(resolveError(result, `Falha ao enviar ${kind === "logo" ? "logo" : "capa"}.`))
        return
      }

      setInfo(`${kind === "logo" ? "Logo" : "Capa"} atualizado com sucesso.`)
      if (kind === "logo") {
        setLogoFile(null)
      } else {
        setCoverFile(null)
      }
      await loadData()
    } catch {
      setError(`Falha de conexao ao enviar ${kind === "logo" ? "logo" : "capa"}.`)
    } finally {
      if (kind === "logo") {
        setUploadingLogo(false)
      } else {
        setUploadingCover(false)
      }
    }
  }

  if (state !== "ready") {
    return (
      <OwnerShell
        title="Editar barbearia"
        subtitle="Atualize dados principais e identidade visual."
        activePath="/owner/barbershop/edit"
        statusLabel={barbershopStatus}
      >
        <OwnerGate state={state} error={accessError} />
      </OwnerShell>
    )
  }

  return (
    <OwnerShell
      title="Editar barbearia"
      subtitle="Dados operacionais, endereco, slug e identidade visual."
      activePath="/owner/barbershop/edit"
      statusLabel={shop?.status ?? barbershopStatus}
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

      <section className="grid gap-4 rounded-2xl border border-white/12 bg-[#0b1330]/84 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#dbe4ff]">Logo atual</p>
          <div className="overflow-hidden rounded-xl border border-white/12 bg-[#090f26]/80 p-2">
            {shop?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logoUrl}
                alt="Logo da barbearia"
                className="h-28 w-full rounded-lg object-contain bg-[#0b1330]"
              />
            ) : (
              <div className="flex h-28 items-center justify-center rounded-lg bg-[#0b1330] text-xs text-[#9fb1e2]">
                Logo nao configurado
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            className="w-full text-sm text-[#c8d0ec] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a2b66] file:px-3 file:py-2 file:text-[#e7edff] hover:file:bg-[#20367f]"
          />
          <UIButton
            type="button"
            onClick={() => {
              void handleUpload("logo")
            }}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? "Enviando..." : "Atualizar logo"}
          </UIButton>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#dbe4ff]">Capa atual</p>
          <div className="overflow-hidden rounded-xl border border-white/12 bg-[#090f26]/80 p-2">
            {shop?.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.coverUrl}
                alt="Capa da barbearia"
                className="h-28 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-28 items-center justify-center rounded-lg bg-[#0b1330] text-xs text-[#9fb1e2]">
                Capa nao configurada
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            className="w-full text-sm text-[#c8d0ec] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a2b66] file:px-3 file:py-2 file:text-[#e7edff] hover:file:bg-[#20367f]"
          />
          <UIButton
            type="button"
            onClick={() => {
              void handleUpload("cover")
            }}
            disabled={uploadingCover}
          >
            {uploadingCover ? "Enviando..." : "Atualizar capa"}
          </UIButton>
        </div>
      </section>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Telefone</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: formatPhone(event.target.value) }))
              }
              placeholder="(11) 99999-0000"
              required
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Descricao</span>
          <textarea
            className="min-h-[110px] w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Descreva a proposta da sua barbearia."
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Endereco</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Numero</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.addressNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, addressNumber: event.target.value }))}
              required
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Bairro</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.neighborhood}
              onChange={(event) => setForm((prev) => ({ ...prev, neighborhood: event.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Cidade</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.city}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">UF</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 uppercase text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.state}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, state: event.target.value.toUpperCase() }))
              }
              maxLength={2}
              required
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">CEP</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.zipCode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, zipCode: formatZip(event.target.value) }))
              }
              onBlur={() => {
                void handleZipBlur()
              }}
              placeholder="00000-000"
              required
            />
            {loadingZip ? <p className="text-xs text-[#9db3eb]">Buscando CEP...</p> : null}
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Slug</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="minha-barbearia"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">CNPJ</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
              value={form.cnpj}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, cnpj: formatCnpj(event.target.value) }))
              }
              placeholder="00.000.000/0000-00"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <UIButton type="submit" disabled={saving || loadingData}>
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </UIButton>
          <UIButton type="button" variant="secondary" onClick={loadData} disabled={loadingData}>
            {loadingData ? "Carregando..." : "Recarregar dados"}
          </UIButton>
        </div>
      </form>
    </OwnerShell>
  )
}
