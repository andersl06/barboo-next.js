"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  clearAccessToken,
  fetchMeContext,
  getAccessToken,
} from "@/lib/client/session"

type MenuScope = "client" | "barber" | "owner"

type MeContextData = {
  user: {
    id: string
    name: string
    email: string
    onboardingIntent: "CLIENT" | "OWNER"
    onboardingStatus: "PENDING" | "DONE"
    mustChangePassword: boolean
  }
  effectiveRole: "OWNER" | "BARBER" | "CLIENT"
  ownerBarbershopId: string | null
  ownerBarbershopSlug: string | null
  barberBarbershopId: string | null
  barbershopStatus: string | null
  onboardingPending: boolean
  hasClientLocation: boolean
  clientLocationUpdatedAt: string | null
}

type ApiFailure = {
  success: false
  code: string
  message: string
}

type ApiResult<T> =
  | { success: true; data: T }
  | ApiFailure

type AppointmentOverviewItem = {
  id: string
  barbershopId: string
  startAt: string
  endAt: string
  status: "CONFIRMED" | "CANCELED" | "REJECTED"
  barbershop: {
    id: string
    name: string
    slug: string | null
  }
  service: {
    id: string
    name: string
    durationMinutes: number
  }
  barberUser: {
    id: string
    name: string
  }
  clientUser: {
    id: string
    name: string
  }
}

type AppointmentOverviewData = {
  scope: "CLIENT" | "BARBER" | "OWNER"
  next: AppointmentOverviewItem | null
  history: AppointmentOverviewItem | null
  upcomingCount: number
  historyCount: number
}

type MenuItem = {
  href: string
  label: string
  icon: "home" | "calendar" | "heart" | "user" | "settings" | "team" | "money" | "shop"
  disabled?: boolean
  soon?: boolean
}

const HIDDEN_PREFIXES = ["/login", "/cadastro", "/auth", "/onboarding", "/api"]
const HIDDEN_EXACT_PATHS = ["/"]

function shouldHideMenu(pathname: string) {
  if (HIDDEN_EXACT_PATHS.includes(pathname)) {
    return true
  }

  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function resolveScope(pathname: string): MenuScope {
  if (pathname.startsWith("/owner")) return "owner"
  if (pathname.startsWith("/barber") || pathname.startsWith("/barbeiro")) return "barber"
  return "client"
}

function roleLabel(scope: MenuScope) {
  if (scope === "owner") return "Proprietario"
  if (scope === "barber") return "Barbeiro"
  return "Cliente"
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value))
}

function statusLabel(status: AppointmentOverviewItem["status"]) {
  if (status === "CONFIRMED") return "Confirmado"
  if (status === "CANCELED") return "Cancelado"
  return "Recusado"
}

function resolveMenuItems(scope: MenuScope, context: MeContextData | null): MenuItem[] {
  if (scope === "owner") {
    const ownerBarbershopHref = context?.ownerBarbershopSlug
      ? `/barbearias/${context.ownerBarbershopSlug}`
      : context?.ownerBarbershopId
        ? `/barbearias/id/${context.ownerBarbershopId}`
        : "/owner/barbershop/edit"

    return [
      { href: "/cliente/barbearias-proximas", label: "Inicio", icon: "home" },
      { href: "/owner/barbershop/edit", label: "Editar barbearia", icon: "settings" },
      { href: "/owner/categories", label: "Categorias", icon: "settings" },
      { href: "/owner/services", label: "Servicos", icon: "settings" },
      { href: "/owner/team", label: "Equipe", icon: "team" },
      { href: "/owner/availability", label: "Agenda", icon: "calendar" },
      { href: "/owner/finance", label: "Financas", icon: "money" },
      { href: "/owner/profile", label: "Meu perfil", icon: "user" },
      { href: ownerBarbershopHref, label: "Minha barbearia", icon: "shop" },
    ]
  }

  if (scope === "barber") {
    return [
      { href: "/cliente/barbearias-proximas", label: "Inicio", icon: "home" },
      { href: "/barber/dashboard", label: "Dashboard", icon: "settings" },
      { href: "/barber/agenda", label: "Agenda", icon: "calendar" },
      { href: "/barber/edit", label: "Meu perfil", icon: "user" },
    ]
  }

  return [
    { href: "/cliente/barbearias-proximas", label: "Inicio", icon: "home" },
    {
      href: "/cliente/agendamentos",
      label: "Meus agendamentos",
      icon: "calendar",
      disabled: true,
      soon: true,
    },
    {
      href: "/cliente/favoritos",
      label: "Favoritos",
      icon: "heart",
      disabled: true,
      soon: true,
    },
    {
      href: "/cliente/perfil",
      label: "Meu perfil",
      icon: "user",
      disabled: true,
      soon: true,
    },
  ]
}

function resolveOverviewLink(scope: MenuScope) {
  if (scope === "owner") return "/owner/availability"
  if (scope === "barber") return "/barber/agenda"
  return "/cliente/agendamentos"
}

function resolveScopeQuery(scope: MenuScope) {
  if (scope === "owner") return "owner"
  if (scope === "barber") return "barber"
  return "client"
}

function Icon({ kind }: { kind: MenuItem["icon"] }) {
  if (kind === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M3 11.5 12 4l9 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6.5 10.5V20h11V10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === "calendar") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === "heart") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 20s-6.5-4.15-8.7-7.35C1.1 9.55 2.4 6 5.9 6c2.1 0 3.25 1.25 4.1 2.3.85-1.05 2-2.3 4.1-2.3 3.5 0 4.8 3.55 2.6 6.65C18.5 15.85 12 20 12 20Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === "user") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 19c1.8-2.8 4.1-4 7-4s5.2 1.2 7 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === "team") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="8" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16.5" cy="8.2" r="1.8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.6 18c1.1-2 2.5-2.9 4.4-2.9 1.9 0 3.3.9 4.4 2.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14.7 16.7c.7-1.2 1.7-1.8 3-1.8.8 0 1.6.3 2.3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === "money") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 9h.01M17 15h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (kind === "shop") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M4 9.5h16l-1 9H5l-1-9Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 9.5V6.7A2.7 2.7 0 0 1 9.7 4h4.6A2.7 2.7 0 0 1 17 6.7v2.8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M5 6h14M5 12h14M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path d="M4 6.75h16M4 12h16M4 17.25h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function FloatingRoleMenu() {
  const pathname = usePathname()
  const router = useRouter()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [context, setContext] = useState<MeContextData | null>(null)
  const [loadingContext, setLoadingContext] = useState(true)
  const [overview, setOverview] = useState<AppointmentOverviewData | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const hidden = shouldHideMenu(pathname)
  const scope = resolveScope(pathname)
  const hasSessionMarker = Boolean(getAccessToken())

  const menuItems = useMemo(() => resolveMenuItems(scope, context), [scope, context])
  const overviewLink = resolveOverviewLink(scope)
  const isClientScope = scope === "client"

  const loadContext = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setContext(null)
      setLoadingContext(false)
      return
    }

    setLoadingContext(true)
    try {
      const result = await fetchMeContext(token)
      if (!result.success) {
        setContext(null)
        return
      }

      setContext(result.data)
    } catch {
      setContext(null)
    } finally {
      setLoadingContext(false)
    }
  }, [])

  const loadOverview = useCallback(async () => {
    if (!context) return

    setLoadingOverview(true)
    setOverviewError(null)

    try {
      const response = await fetch(
        `/api/me/appointments/overview?scope=${resolveScopeQuery(scope)}`,
        { cache: "no-store" }
      )
      const result = await response.json() as ApiResult<AppointmentOverviewData>

      if (!result.success) {
        setOverview(null)
        setOverviewError(result.message)
        return
      }

      setOverview(result.data)
    } catch {
      setOverview(null)
      setOverviewError("Nao foi possivel carregar os agendamentos agora.")
    } finally {
      setLoadingOverview(false)
    }
  }, [context, scope])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  useEffect(() => {
    void loadContext()
  }, [pathname, loadContext])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      void loadContext()
    }

    window.addEventListener("focus", handleVisibilityChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleVisibilityChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadContext])

  useEffect(() => {
    if (!isOpen) return
    void loadOverview()
  }, [isOpen, loadOverview])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    closeButtonRef.current?.focus()
  }, [isOpen])

  const handleLogout = useCallback(() => {
    clearAccessToken()
    setIsOpen(false)
    router.push("/login")
  }, [router])

  if (hidden || loadingContext || !hasSessionMarker || !context) {
    return null
  }

  const greeting = `Ola, ${roleLabel(scope)}!`

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu de navegacao"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 right-auto z-[1100] inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#f36c20]/60 bg-[linear-gradient(180deg,#f47b34_0%,#f36c20_100%)] text-white shadow-[0_16px_35px_rgba(0,0,0,0.45)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f36c20]/50"
      >
        <HamburgerIcon />
      </button>

      <div
        className={`fixed inset-0 z-[1095] bg-[#02040b]/70 transition-opacity ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        className={`fixed bottom-0 left-0 right-0 z-[1099] max-h-[84svh] rounded-t-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(21,25,56,0.98)_0%,rgba(12,16,39,0.98)_100%)] text-[#f1f2f7] shadow-[0_-12px_40px_rgba(0,0,0,0.55)] transition-transform md:top-0 md:right-auto md:max-h-none md:w-[390px] md:rounded-none md:rounded-r-3xl md:shadow-[20px_0_50px_rgba(0,0,0,0.5)] ${
          isOpen
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[#aab4d6]">Menu</p>
              <h2 className="text-lg font-semibold text-[#f7f8ff]">{greeting} ??</h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#dbe4ff] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f36c20]/45"
              aria-label="Fechar menu"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <section className="space-y-2 rounded-2xl border border-white/10 bg-[#0a1331]/85 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Proximos Agendamentos</h3>
                <Link
                  href={overviewLink}
                  className={`text-xs font-semibold ${
                    isClientScope
                      ? "pointer-events-none text-[#7f8ab0]"
                      : "text-[#f5b28b] hover:text-[#ffd6bf]"
                  }`}
                >
                  {isClientScope ? "Em breve" : "Ver todos"}
                </Link>
              </div>

              {loadingOverview ? (
                <p className="rounded-xl border border-white/10 bg-[#091029]/80 p-3 text-xs text-[#9fb0dd]">
                  Carregando...
                </p>
              ) : overview?.next ? (
                <article className="rounded-xl border border-white/12 bg-[#091029]/90 p-3 text-sm">
                  <p className="font-semibold text-[#e8edff]">{overview.next.service.name}</p>
                  <p className="mt-1 text-xs text-[#b8c3e6]">{formatDateTime(overview.next.startAt)}</p>
                  <p className="mt-1 text-xs text-[#cfd8f6]">{overview.next.barbershop.name}</p>
                  {scope === "barber" ? (
                    <p className="mt-1 text-xs text-[#9fb0dd]">Cliente: {overview.next.clientUser.name}</p>
                  ) : null}
                  {scope === "client" ? (
                    <p className="mt-1 text-xs text-[#9fb0dd]">Barbeiro: {overview.next.barberUser.name}</p>
                  ) : null}
                  {scope === "owner" ? (
                    <p className="mt-1 text-xs text-[#9fb0dd]">
                      {overview.next.barberUser.name} x {overview.next.clientUser.name}
                    </p>
                  ) : null}
                </article>
              ) : (
                <div className="rounded-xl border border-dashed border-white/20 bg-[#091029]/70 p-3">
                  <p className="text-xs text-[#c6d1ef]">Nenhum agendamento confirmado.</p>
                  <Link
                    href="/cliente/barbearias-proximas"
                    className="mt-2 inline-flex text-xs font-semibold text-[#f5b28b] hover:text-[#ffd6bf]"
                  >
                    Agendar agora
                  </Link>
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-2xl border border-white/10 bg-[#0a1331]/85 p-3">
              <h3 className="text-sm font-semibold">Historico</h3>
              {loadingOverview ? (
                <p className="rounded-xl border border-white/10 bg-[#091029]/80 p-3 text-xs text-[#9fb0dd]">
                  Carregando...
                </p>
              ) : overview?.history ? (
                <article className="rounded-xl border border-white/12 bg-[#091029]/90 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[#e8edff]">{overview.history.service.name}</p>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-[#c9d4f5]">
                      {statusLabel(overview.history.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#b8c3e6]">{formatDateTime(overview.history.startAt)}</p>
                  <p className="mt-1 text-xs text-[#cfd8f6]">{overview.history.barbershop.name}</p>
                </article>
              ) : (
                <p className="rounded-xl border border-dashed border-white/20 bg-[#091029]/70 p-3 text-xs text-[#c6d1ef]">
                  Nenhum agendamento anterior.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0a1331]/85 p-3">
              <h3 className="text-sm font-semibold">Menu</h3>
              <div className="mt-2 space-y-1">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href

                  if (item.disabled) {
                    return (
                      <div
                        key={item.href}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b1433]/65 px-3 py-2 text-sm text-[#8d98bc] opacity-70"
                        title="Em breve"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon kind={item.icon} />
                          {item.label}
                        </span>
                        {item.soon ? (
                          <span className="rounded-full border border-[#f36c20]/30 bg-[#f36c20]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ffcfb4]">
                            Em breve
                          </span>
                        ) : null}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border-[#f36c20]/50 bg-[#f36c20]/18 text-[#ffe4d6]"
                          : "border-white/10 bg-[#0b1433]/65 text-[#d2daf4] hover:border-white/20 hover:bg-[#111b45]"
                      }`}
                    >
                      <Icon kind={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </section>

            {overviewError ? (
              <p className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {overviewError}
              </p>
            ) : null}
          </div>

          <div className="border-t border-white/10 p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center rounded-xl border border-[#f36c20]/45 bg-[#f36c20]/16 px-4 py-2.5 text-sm font-semibold text-[#ffd8c2] transition hover:bg-[#f36c20]/25"
            >
              Sair da conta
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
