"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"
import { fetchMeContext, getAccessToken } from "@/lib/client/session"

type ScreenState =
  | "loading"
  | "unauthenticated"
  | "forbidden"
  | "redirecting"
  | "ready"

type OnboardingStep = 1 | 2 | 3 | 4 | 5

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiSuccess<T> = {
  success: true
  data: T
}

type ApiFailure = {
  success: false
  code: string
  message: string
  errors?: ApiErrorDetail[]
}

type ApiResult<T> = ApiSuccess<T> | ApiFailure
type MeContextResult = Awaited<ReturnType<typeof fetchMeContext>>

type PublishReadinessData = {
  ready: boolean
  status: "EM_CONFIGURACAO" | "ATIVA" | "SUSPENSA"
  summary: {
    activeBarbers: number
    activeCategories: number
    activeServices: number
  }
  checklist: Array<{
    key: string
    ok: boolean
    message: string
    field?: string
  }>
  missing: Array<{
    field?: string
    message: string
  }>
}

type CategoryItem = {
  id: string
  name: string
  description: string | null
}

type ServiceItem = {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  priceCents: number
  durationMinutes: number
}

type TeamSetupMode = "OWNER_SELF" | "ADD_BARBER"

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-5xl">{children}</section>
    </main>
  )
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

function formatZip(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) {
    return digits
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function buildDefaultOpeningHours() {
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

function resolveApiError(result: ApiFailure, fallback: string) {
  if (result.errors?.[0]?.message) {
    return result.errors[0].message
  }

  if (result.message) {
    return result.message
  }

  return fallback
}

function toPriceCents(raw: string) {
  const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "")
  const value = Number(normalized)

  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.round(value * 100)
}

export default function OnboardingProprietarioPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<ScreenState>("loading")
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalInfo, setGlobalInfo] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)

  const [barbershopId, setBarbershopId] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<PublishReadinessData | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])

  const [isCreatingBarbershop, setIsCreatingBarbershop] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isCreatingBarber, setIsCreatingBarber] = useState(false)
  const [isSavingBarberProfile, setIsSavingBarberProfile] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [isCreatingService, setIsCreatingService] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isRefreshingReadiness, setIsRefreshingReadiness] = useState(false)
  const [isZipLookup, setIsZipLookup] = useState(false)

  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formAddressNumber, setFormAddressNumber] = useState("")
  const [formNeighborhood, setFormNeighborhood] = useState("")
  const [formCity, setFormCity] = useState("")
  const [formState, setFormState] = useState("")
  const [formZipCode, setFormZipCode] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formCnpj, setFormCnpj] = useState("")

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)

  const [ownerBio, setOwnerBio] = useState("")
  const [ownerAvatar, setOwnerAvatar] = useState<File | null>(null)
  const [teamSetupMode, setTeamSetupMode] = useState<TeamSetupMode>("OWNER_SELF")
  const [newBarberName, setNewBarberName] = useState("")
  const [newBarberEmail, setNewBarberEmail] = useState("")
  const [newBarberPassword, setNewBarberPassword] = useState("")

  const [categoryName, setCategoryName] = useState("")
  const [categoryDescription, setCategoryDescription] = useState("")

  const [serviceName, setServiceName] = useState("")
  const [serviceDescription, setServiceDescription] = useState("")
  const [servicePrice, setServicePrice] = useState("")
  const [serviceDuration, setServiceDuration] = useState("30")
  const [serviceCategoryId, setServiceCategoryId] = useState("")

  const canPublish = readiness?.ready ?? false

  async function getTokenOrFail() {
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      setGlobalError("Sua sessao expirou. Faca login novamente.")
      return null
    }

    return token
  }

  const bootstrap = useCallback(async () => {
    setGlobalError(null)
    setGlobalInfo(null)

    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    let context: MeContextResult
    try {
      context = await fetchMeContext(token)
    } catch {
      setScreen("forbidden")
      setGlobalError("Nao foi possivel validar sua sessao agora.")
      return
    }

    if (!context.success) {
      setScreen("unauthenticated")
      return
    }

    if (context.data.ownerBarbershopId) {
      setScreen("redirecting")
      router.replace("/owner/dashboard")
      return
    }

    if (
      context.data.onboardingPending ||
      context.data.user.onboardingIntent === "OWNER" ||
      context.data.effectiveRole === "OWNER"
    ) {
      setScreen("ready")
      return
    }

    setScreen("forbidden")
  }, [router])

  async function refreshReadiness(targetBarbershopId: string, token: string) {
    setIsRefreshingReadiness(true)
    try {
      const response = await fetch(`/api/barbershops/${targetBarbershopId}/publish`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<PublishReadinessData>
      if (!result.success) {
        setGlobalError(resolveApiError(result, "Falha ao carregar checklist."))
        return
      }

      setReadiness(result.data)
    } catch {
      setGlobalError("Falha de conexao ao atualizar checklist.")
    } finally {
      setIsRefreshingReadiness(false)
    }
  }

  async function refreshCatalog(targetBarbershopId: string) {
    try {
      const [categoriesResponse, servicesResponse] = await Promise.all([
        fetch(`/api/barbershops/${targetBarbershopId}/categories`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(`/api/barbershops/${targetBarbershopId}/services`, {
          method: "GET",
          cache: "no-store",
        }),
      ])

      const categoriesResult = (await categoriesResponse.json()) as ApiResult<CategoryItem[]>
      const servicesResult = (await servicesResponse.json()) as ApiResult<ServiceItem[]>

      if (categoriesResult.success) {
        setCategories(categoriesResult.data)
      }

      if (servicesResult.success) {
        setServices(servicesResult.data)
      }
    } catch {
      setGlobalError("Falha ao atualizar categorias e servicos.")
    }
  }

  async function handleBecomeOwner() {
    const token = await getTokenOrFail()
    if (!token) return

    setGlobalError(null)
    setGlobalInfo(null)

    try {
      const response = await fetch("/api/me/intent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ onboardingIntent: "OWNER" }),
      })

      const result = (await response.json()) as ApiResult<{
        id: string
        onboardingIntent: "CLIENT" | "OWNER"
        onboardingStatus: "PENDING" | "DONE"
      }>

      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel ativar intencao de owner."))
        return
      }

      await bootstrap()
    } catch {
      setGlobalError("Falha de conexao. Tente novamente.")
    }
  }

  async function handleCreateBarbershop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const token = await getTokenOrFail()
    if (!token) return

    setGlobalError(null)
    setGlobalInfo(null)
    setIsCreatingBarbershop(true)

    try {
      const response = await fetch("/api/barbershops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          phone: onlyDigits(formPhone),
          address: formAddress,
          addressNumber: formAddressNumber,
          neighborhood: formNeighborhood,
          city: formCity,
          state: formState.toUpperCase(),
          zipCode: onlyDigits(formZipCode),
          cnpj: formCnpj.trim() || undefined,
          slug: formSlug.trim() || undefined,
          openingHours: buildDefaultOpeningHours(),
        }),
      })

      const result = (await response.json()) as ApiResult<{
        id: string
        name: string
        slug: string | null
        status: "EM_CONFIGURACAO" | "ATIVA" | "SUSPENSA"
      }>

      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel criar a barbearia."))
        return
      }

      setBarbershopId(result.data.id)
      setCurrentStep(1)
      setGlobalInfo("Barbearia criada. Continue os passos para publicar.")
      await Promise.all([refreshReadiness(result.data.id, token), refreshCatalog(result.data.id)])
    } catch {
      setGlobalError("Falha de conexao ao criar barbearia.")
    } finally {
      setIsCreatingBarbershop(false)
    }
  }

  async function handleUploadLogo() {
    if (!barbershopId) return

    const token = await getTokenOrFail()
    if (!token) return

    if (!logoFile) {
      setGlobalError("Selecione um arquivo para enviar o logo.")
      return
    }

    setGlobalError(null)
    setGlobalInfo(null)
    setIsUploadingLogo(true)

    try {
      const formData = new FormData()
      formData.append("file", logoFile)

      const response = await fetch(`/api/barbershops/${barbershopId}/logo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const result = (await response.json()) as ApiResult<{ logoUrl: string }>
      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel enviar o logo."))
        return
      }

      setGlobalInfo("Logo atualizado com sucesso.")
      await refreshReadiness(barbershopId, token)
    } catch {
      setGlobalError("Falha de conexao ao enviar logo.")
    } finally {
      setIsUploadingLogo(false)
    }
  }

  async function handleUploadCover() {
    if (!barbershopId) return

    const token = await getTokenOrFail()
    if (!token) return

    if (!coverFile) {
      setGlobalError("Selecione um arquivo para enviar a capa.")
      return
    }

    setGlobalError(null)
    setGlobalInfo(null)
    setIsUploadingCover(true)

    try {
      const formData = new FormData()
      formData.append("file", coverFile)

      const response = await fetch(`/api/barbershops/${barbershopId}/cover`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const result = (await response.json()) as ApiResult<{ coverUrl: string }>
      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel enviar a capa."))
        return
      }

      setGlobalInfo("Capa atualizada com sucesso.")
      await refreshReadiness(barbershopId, token)
    } catch {
      setGlobalError("Falha de conexao ao enviar capa.")
    } finally {
      setIsUploadingCover(false)
    }
  }

  async function handleCreateBarber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!barbershopId) return

    const token = await getTokenOrFail()
    if (!token) return

    setGlobalError(null)
    setGlobalInfo(null)
    setIsCreatingBarber(true)

    try {
      const response = await fetch(`/api/barbershops/${barbershopId}/barbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newBarberName || undefined,
          email: newBarberEmail.trim().toLowerCase(),
          password: newBarberPassword,
        }),
      })

      const result = (await response.json()) as ApiResult<{
        barber: {
          id: string
          email: string
        }
      }>
      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel criar barbeiro."))
        return
      }

      setNewBarberName("")
      setNewBarberEmail("")
      setNewBarberPassword("")
      setGlobalInfo("Barbeiro criado. O avatar podera ser configurado por ele.")
      await refreshReadiness(barbershopId, token)
    } catch {
      setGlobalError("Falha de conexao ao criar barbeiro.")
    } finally {
      setIsCreatingBarber(false)
    }
  }

  async function handleZipBlur() {
    const zipDigits = onlyDigits(formZipCode)
    if (zipDigits.length !== 8) {
      return
    }

    setIsZipLookup(true)
    setGlobalError(null)
    try {
      const response = await fetch(`/api/utils/zip/${zipDigits}`, {
        method: "GET",
      })
      const result = (await response.json()) as ApiResult<{
        address: string
        neighborhood: string
        city: string
        state: string
      }>

      if (!result.success) {
        return
      }

      setFormAddress((prev) => (prev.trim().length > 0 ? prev : result.data.address))
      setFormNeighborhood((prev) =>
        prev.trim().length > 0 ? prev : result.data.neighborhood
      )
      setFormCity((prev) => (prev.trim().length > 0 ? prev : result.data.city))
      setFormState((prev) => (prev.trim().length > 0 ? prev : result.data.state))
    } catch {
      // Mantem preenchimento manual quando lookup falhar.
    } finally {
      setIsZipLookup(false)
    }
  }

  async function handleSaveOwnerProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!barbershopId) return

    const token = await getTokenOrFail()
    if (!token) return

    const normalizedBio = ownerBio.trim()
    if (!normalizedBio) {
      setGlobalError("Preencha a bio para continuar.")
      return
    }

    if (!ownerAvatar) {
      setGlobalError("Envie o avatar para continuar.")
      return
    }

    setGlobalError(null)
    setGlobalInfo(null)
    setIsSavingBarberProfile(true)

    try {
      const membershipResponse = await fetch(`/api/barbershops/${barbershopId}/owner/become-barber`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const membershipResult = (await membershipResponse.json()) as ApiResult<{
        barberProfileId: string
        alreadyBarber: boolean
      }>

      if (!membershipResult.success) {
        setGlobalError(
          resolveApiError(membershipResult, "Nao foi possivel habilitar owner como barbeiro.")
        )
        return
      }

      const profileResponse = await fetch("/api/barbers/me/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bio: normalizedBio,
        }),
      })

      const profileResult = (await profileResponse.json()) as ApiResult<{
        userId: string
        bio: string | null
      }>

      if (!profileResult.success) {
        setGlobalError(resolveApiError(profileResult, "Nao foi possivel salvar bio do barbeiro."))
        return
      }

      const avatarData = new FormData()
      avatarData.append("file", ownerAvatar)

      const avatarResponse = await fetch("/api/barbers/me/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: avatarData,
      })

      const avatarResult = (await avatarResponse.json()) as ApiResult<{
        userId: string
        avatarUrl: string
      }>

      if (!avatarResult.success) {
        setGlobalError(resolveApiError(avatarResult, "Bio salva, mas o avatar falhou."))
        return
      }

      setGlobalInfo("Owner configurado como barbeiro com sucesso.")
      await refreshReadiness(barbershopId, token)
    } catch {
      setGlobalError("Falha de conexao ao salvar perfil do barbeiro.")
    } finally {
      setIsSavingBarberProfile(false)
    }
  }

  async function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!barbershopId) return

    const token = await getTokenOrFail()
    if (!token) return

    setGlobalError(null)
    setGlobalInfo(null)
    setIsCreatingCategory(true)

    try {
      const response = await fetch(`/api/barbershops/${barbershopId}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: categoryName,
          description: categoryDescription || undefined,
        }),
      })

      const result = (await response.json()) as ApiResult<CategoryItem>
      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel criar categoria."))
        return
      }

      setCategoryName("")
      setCategoryDescription("")
      setGlobalInfo("Categoria criada com sucesso.")
      await Promise.all([refreshCatalog(barbershopId), refreshReadiness(barbershopId, token)])
    } catch {
      setGlobalError("Falha de conexao ao criar categoria.")
    } finally {
      setIsCreatingCategory(false)
    }
  }

  async function handleCreateService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!barbershopId) return

    const token = await getTokenOrFail()
    if (!token) return

    const duration = Number(serviceDuration)
    const priceCents = toPriceCents(servicePrice)

    if (!Number.isInteger(duration) || duration < 5) {
      setGlobalError("Duracao invalida. Use pelo menos 5 minutos.")
      return
    }

    if (priceCents === null) {
      setGlobalError("Preco invalido. Informe um valor maior que zero.")
      return
    }

    setGlobalError(null)
    setGlobalInfo(null)
    setIsCreatingService(true)

    try {
      const response = await fetch(`/api/barbershops/${barbershopId}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: serviceCategoryId || undefined,
          name: serviceName,
          description: serviceDescription || undefined,
          priceCents,
          durationMinutes: duration,
        }),
      })

      const result = (await response.json()) as ApiResult<ServiceItem>
      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel criar servico."))
        return
      }

      setServiceName("")
      setServiceDescription("")
      setServicePrice("")
      setServiceDuration("30")
      setServiceCategoryId("")
      setGlobalInfo("Servico criado com sucesso.")
      await Promise.all([refreshCatalog(barbershopId), refreshReadiness(barbershopId, token)])
    } catch {
      setGlobalError("Falha de conexao ao criar servico.")
    } finally {
      setIsCreatingService(false)
    }
  }

  async function handlePublishBarbershop() {
    if (!barbershopId) return

    const token = await getTokenOrFail()
    if (!token) return

    setGlobalError(null)
    setGlobalInfo(null)
    setIsPublishing(true)

    try {
      const response = await fetch(`/api/barbershops/${barbershopId}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json()) as ApiResult<{
        published: boolean
        status?: "ATIVA"
      }>

      if (!result.success) {
        setGlobalError(resolveApiError(result, "Nao foi possivel publicar a barbearia."))
        await refreshReadiness(barbershopId, token)
        return
      }

      router.push("/owner/dashboard?published=1")
    } catch {
      setGlobalError("Falha de conexao ao publicar barbearia.")
    } finally {
      setIsPublishing(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void bootstrap()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [bootstrap])

  const readinessStatusColor = useMemo(() => {
    if (!readiness) return "text-[#a7b1d0]"
    if (readiness.ready) return "text-emerald-300"
    return "text-amber-300"
  }, [readiness])

  const pendingChecklistItems = useMemo(
    () => readiness?.checklist.filter((item) => !item.ok) ?? [],
    [readiness]
  )

  if (screen === "loading") {
    return (
      <Wrapper>
        <div className="flex min-h-[40svh] items-center justify-center rounded-3xl border border-white/10 bg-[#0d1434]/75">
          <p className="text-base text-[#d0d7ef]">Carregando onboarding...</p>
        </div>
      </Wrapper>
    )
  }

  if (screen === "redirecting") {
    return (
      <Wrapper>
        <div className="flex min-h-[40svh] items-center justify-center rounded-3xl border border-white/10 bg-[#0d1434]/75">
          <p className="text-base text-[#d0d7ef]">Redirecionando para gestao da barbearia...</p>
        </div>
      </Wrapper>
    )
  }

  if (screen === "unauthenticated") {
    return (
      <Wrapper>
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <Image
            src="/assets/brand/barboo_logo.png"
            alt="Barboo"
            width={230}
            height={70}
            className="mx-auto h-auto w-[190px]"
          />
          <h1 className="mt-6 text-2xl font-semibold">Voce precisa entrar</h1>
          <p className="mt-2 text-sm text-[#a7b1d0]">
            Faca login para continuar seu onboarding de proprietario.
          </p>
          <Link
            className="mt-5 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10"
            href="/login?next=%2Fonboarding%2Fproprietario"
          >
            Ir para login
          </Link>
        </section>
      </Wrapper>
    )
  }

  if (screen === "forbidden") {
    return (
      <Wrapper>
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <Image
            src="/assets/brand/barboo_logo.png"
            alt="Barboo"
            width={230}
            height={70}
            className="h-auto w-[190px]"
          />
          <h1 className="mt-5 text-2xl font-semibold">Ativar fluxo de proprietario</h1>
          <p className="mt-2 text-sm text-[#a7b1d0]">
            Sua conta ainda nao esta no fluxo de owner. Ative para continuar.
          </p>
          {globalError ? <p className="mt-3 text-sm text-red-300">{globalError}</p> : null}
          <div className="mt-5">
            <UIButton onClick={handleBecomeOwner}>Ativar onboarding de proprietario</UIButton>
          </div>
        </section>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <Image
          src="/assets/brand/barboo_logo.png"
          alt="Barboo"
          width={250}
          height={70}
          className="h-auto w-[190px]"
        />

        <h1 className="mt-6 text-3xl font-bold tracking-tight">Cadastre e publique sua barbearia</h1>
        <p className="mt-2 text-sm text-[#a7b1d0] md:text-base">
          Complete os passos para deixar sua barbearia pronta para clientes.
        </p>

        {globalError ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {globalError}
          </p>
        ) : null}
        {globalInfo ? (
          <p className="mt-4 rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
            {globalInfo}
          </p>
        ) : null}

        {!barbershopId ? (
          <form className="mt-6 space-y-4" onSubmit={handleCreateBarbershop}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  placeholder="Nome da barbearia"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Telefone</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formPhone}
                  onChange={(event) => setFormPhone(event.target.value)}
                  placeholder="(11) 99999-0000"
                  required
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Descricao</span>
              <textarea
                className="min-h-[110px] w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
                placeholder="Fale sobre o posicionamento da sua barbearia."
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Endereco</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formAddress}
                  onChange={(event) => setFormAddress(event.target.value)}
                  placeholder="Rua, avenida..."
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Numero</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formAddressNumber}
                  onChange={(event) => setFormAddressNumber(event.target.value)}
                  placeholder="123"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Bairro</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formNeighborhood}
                  onChange={(event) => setFormNeighborhood(event.target.value)}
                  placeholder="Centro"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Cidade</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formCity}
                  onChange={(event) => setFormCity(event.target.value)}
                  placeholder="Sao Paulo"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">UF</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 uppercase text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formState}
                  onChange={(event) => setFormState(event.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="SP"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">CEP</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formZipCode}
                  onChange={(event) => setFormZipCode(formatZip(event.target.value))}
                  onBlur={() => {
                    void handleZipBlur()
                  }}
                  placeholder="00000-000"
                  required
                />
                {isZipLookup ? (
                  <p className="text-xs text-[#9db3eb]">Buscando CEP...</p>
                ) : null}
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Slug (opcional)</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formSlug}
                  onChange={(event) => setFormSlug(event.target.value)}
                  placeholder="minha-barbearia"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">CNPJ (opcional)</span>
                <input
                  className="w-full rounded-xl border border-white/15 bg-[#090f26]/80 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                  value={formCnpj}
                  onChange={(event) => setFormCnpj(event.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </label>
            </div>

            <UIButton type="submit" className="w-full" disabled={isCreatingBarbershop}>
              {isCreatingBarbershop ? "Criando barbearia..." : "Criar barbearia"}
            </UIButton>
          </form>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setCurrentStep(step as OnboardingStep)}
                  aria-label={`Ir para passo ${step}`}
                  className={`h-3 rounded-full transition ${
                    step <= currentStep
                      ? "bg-[#f36c20] shadow-[0_0_16px_rgba(243,108,32,0.45)]"
                      : "bg-white/14 hover:bg-white/30"
                  }`}
                >
                  <span className="sr-only">Passo {step}</span>
                </button>
              ))}
            </div>

            {currentStep === 1 ? (
              <section className="rounded-2xl border border-white/12 bg-[#090f26]/72 p-4">
                <h2 className="text-lg font-semibold">Logo e capa</h2>
                <p className="mt-1 text-sm text-[#a7b1d0]">
                  Envie os dois arquivos para identidade da barbearia.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[#dbe4ff]">Logo</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                      className="w-full text-sm text-[#c8d0ec] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a2b66] file:px-3 file:py-2 file:text-[#e7edff] hover:file:bg-[#20367f]"
                    />
                    <UIButton type="button" onClick={handleUploadLogo} disabled={isUploadingLogo}>
                      {isUploadingLogo ? "Enviando logo..." : "Enviar logo"}
                    </UIButton>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[#dbe4ff]">Capa</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                      className="w-full text-sm text-[#c8d0ec] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a2b66] file:px-3 file:py-2 file:text-[#e7edff] hover:file:bg-[#20367f]"
                    />
                    <UIButton type="button" onClick={handleUploadCover} disabled={isUploadingCover}>
                      {isUploadingCover ? "Enviando capa..." : "Enviar capa"}
                    </UIButton>
                  </div>
                </div>
                <div className="mt-4">
                  <UIButton type="button" onClick={() => setCurrentStep(2)}>
                    Ir para equipe
                  </UIButton>
                </div>
              </section>
            ) : null}

            {currentStep === 2 ? (
              <section className="rounded-2xl border border-white/12 bg-[#090f26]/72 p-4">
                <h2 className="text-lg font-semibold">Equipe</h2>
                <p className="mt-1 text-sm text-[#a7b1d0]">Escolha como deseja configurar o primeiro barbeiro.</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTeamSetupMode("OWNER_SELF")}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      teamSetupMode === "OWNER_SELF"
                        ? "border-[#f36c20]/70 bg-[#f36c20]/16 text-[#ffe2d3]"
                        : "border-white/15 bg-white/5 text-[#d6def6] hover:border-white/30"
                    }`}
                  >
                    Sou o proprio barbeiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamSetupMode("ADD_BARBER")}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      teamSetupMode === "ADD_BARBER"
                        ? "border-[#f36c20]/70 bg-[#f36c20]/16 text-[#ffe2d3]"
                        : "border-white/15 bg-white/5 text-[#d6def6] hover:border-white/30"
                    }`}
                  >
                    Adicionar novo barbeiro
                  </button>
                </div>

                {teamSetupMode === "OWNER_SELF" ? (
                  <form className="mt-4 space-y-3" onSubmit={handleSaveOwnerProfile}>
                    <label className="block space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Bio do owner barbeiro</span>
                      <textarea
                        className="min-h-[110px] w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={ownerBio}
                        onChange={(event) => setOwnerBio(event.target.value)}
                        placeholder="Especialista em cortes classicos e atendimento premium."
                        required
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Avatar do owner</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => setOwnerAvatar(event.target.files?.[0] ?? null)}
                        className="w-full text-sm text-[#c8d0ec] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a2b66] file:px-3 file:py-2 file:text-[#e7edff] hover:file:bg-[#20367f]"
                        required
                      />
                    </label>
                    <UIButton type="submit" disabled={isSavingBarberProfile}>
                      {isSavingBarberProfile ? "Salvando..." : "Sou o proprio barbeiro"}
                    </UIButton>
                  </form>
                ) : (
                  <form className="mt-4 space-y-3" onSubmit={handleCreateBarber}>
                    <label className="block space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome (opcional)</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={newBarberName}
                        onChange={(event) => setNewBarberName(event.target.value)}
                        placeholder="Nome do barbeiro"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">E-mail</span>
                      <input
                        type="email"
                        className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={newBarberEmail}
                        onChange={(event) => setNewBarberEmail(event.target.value)}
                        placeholder="barbeiro@email.com"
                        required
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Senha inicial</span>
                      <input
                        type="password"
                        className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={newBarberPassword}
                        onChange={(event) => setNewBarberPassword(event.target.value)}
                        placeholder="Minimo 6 caracteres"
                        required
                      />
                    </label>
                    <UIButton type="submit" disabled={isCreatingBarber}>
                      {isCreatingBarber ? "Criando..." : "Criar novo barbeiro"}
                    </UIButton>
                    <p className="text-xs text-[#9fb1e2]">
                      Bio e avatar podem ser configurados depois pelo proprio barbeiro.
                    </p>
                  </form>
                )}

                <div className="mt-4 flex gap-3">
                  <UIButton type="button" variant="secondary" onClick={() => setCurrentStep(1)}>
                    Voltar
                  </UIButton>
                  <UIButton type="button" onClick={() => setCurrentStep(3)}>
                    Ir para categorias
                  </UIButton>
                </div>
              </section>
            ) : null}

            {currentStep === 3 ? (
              <section className="rounded-2xl border border-white/12 bg-[#090f26]/72 p-4">
                <h2 className="text-lg font-semibold">Categorias</h2>
                <form className="mt-3 space-y-3" onSubmit={handleCreateCategory}>
                  <label className="block space-y-1">
                    <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                      value={categoryName}
                      onChange={(event) => setCategoryName(event.target.value)}
                      placeholder="Cortes"
                      required
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Descricao</span>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                      value={categoryDescription}
                      onChange={(event) => setCategoryDescription(event.target.value)}
                      placeholder="Servicos principais"
                    />
                  </label>
                  <UIButton type="submit" disabled={isCreatingCategory}>
                    {isCreatingCategory ? "Criando..." : "Criar categoria"}
                  </UIButton>
                </form>
                <div className="mt-4 space-y-1 text-sm text-[#c9d2ef]">
                  {categories.length > 0 ? (
                    categories.map((category) => <p key={category.id}>- {category.name}</p>)
                  ) : (
                    <p>Nenhuma categoria criada ainda.</p>
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  <UIButton type="button" variant="secondary" onClick={() => setCurrentStep(2)}>
                    Voltar
                  </UIButton>
                  <UIButton type="button" onClick={() => setCurrentStep(4)}>
                    Ir para servicos
                  </UIButton>
                </div>
              </section>
            ) : null}

            {currentStep === 4 ? (
              <section className="rounded-2xl border border-white/12 bg-[#090f26]/72 p-4">
                <h2 className="text-lg font-semibold">Servicos</h2>
                <form className="mt-3 space-y-3" onSubmit={handleCreateService}>
                  <label className="block space-y-1">
                    <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Nome</span>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                      value={serviceName}
                      onChange={(event) => setServiceName(event.target.value)}
                      placeholder="Corte social"
                      required
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Categoria</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                      value={serviceCategoryId}
                      onChange={(event) => setServiceCategoryId(event.target.value)}
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Preco (R$)</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        value={servicePrice}
                        onChange={(event) => setServicePrice(event.target.value)}
                        placeholder="35,00"
                        required
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Duracao (min)</span>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                        type="number"
                        min={5}
                        step={5}
                        value={serviceDuration}
                        onChange={(event) => setServiceDuration(event.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs uppercase tracking-[0.08em] text-[#aeb8db]">Descricao</span>
                    <input
                      className="w-full rounded-xl border border-white/15 bg-[#0b1330]/85 px-3 py-2.5 text-[#f1f2f7] outline-none focus:border-[#3f77f5]"
                      value={serviceDescription}
                      onChange={(event) => setServiceDescription(event.target.value)}
                      placeholder="Com finalizacao"
                    />
                  </label>
                  <UIButton type="submit" disabled={isCreatingService}>
                    {isCreatingService ? "Criando..." : "Criar servico"}
                  </UIButton>
                </form>
                <div className="mt-4 space-y-1 text-sm text-[#c9d2ef]">
                  {services.length > 0 ? (
                    services.map((service) => (
                      <p key={service.id}>
                        - {service.name} ({service.durationMinutes} min)
                      </p>
                    ))
                  ) : (
                    <p>Nenhum servico criado ainda.</p>
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  <UIButton type="button" variant="secondary" onClick={() => setCurrentStep(3)}>
                    Voltar
                  </UIButton>
                  <UIButton type="button" onClick={() => setCurrentStep(5)}>
                    Ir para publicacao
                  </UIButton>
                </div>
              </section>
            ) : null}

            {currentStep === 5 ? (
              <section className="rounded-2xl border border-white/12 bg-[#090f26]/72 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-lg font-semibold">Publicacao</h2>
                  <p className={`text-sm font-medium ${readinessStatusColor}`}>
                    {readiness?.ready
                      ? "Pronto para publicar"
                      : readiness
                        ? "Ainda faltam configuracoes"
                        : "Checklist ainda nao carregado"}
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {pendingChecklistItems.length > 0 ? (
                    pendingChecklistItems.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                      >
                        PENDENTE - {item.message}
                      </div>
                    ))
                  ) : readiness ? (
                    <div className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                      Nenhuma pendencia encontrada.
                    </div>
                  ) : (
                    <p className="text-sm text-[#a7b1d0]">Checklist ainda nao carregado.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <UIButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!barbershopId) return
                      const token = getAccessToken()
                      if (!token) return
                      void refreshReadiness(barbershopId, token)
                    }}
                    disabled={isRefreshingReadiness}
                  >
                    {isRefreshingReadiness ? "Atualizando..." : "Atualizar checklist"}
                  </UIButton>
                  <UIButton
                    type="button"
                    onClick={handlePublishBarbershop}
                    disabled={isPublishing || !canPublish}
                  >
                    {isPublishing ? "Publicando..." : "Publicar barbearia"}
                  </UIButton>
                </div>

                <div className="mt-4">
                  <UIButton type="button" variant="secondary" onClick={() => setCurrentStep(4)}>
                    Voltar para servicos
                  </UIButton>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </Wrapper>
  )
}
