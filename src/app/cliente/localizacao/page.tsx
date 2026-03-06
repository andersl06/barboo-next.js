"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"
import { fetchMeContext, getAccessToken } from "@/lib/client/session"

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

function LocationBlockedIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-12 w-12">
      <path
        d="M32 10c9.941 0 18 8.059 18 18 0 9.005-6.616 16.466-15.248 17.79L32 54l-2.752-8.21C20.616 44.466 14 37.005 14 28c0-9.941 8.059-18 18-18Z"
        stroke="currentColor"
        strokeWidth="3.2"
      />
      <path
        d="M25 24c0-3.866 3.134-7 7-7m0 0c3.866 0 7 3.134 7 7m-7-7v4"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M16 16 48 48"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function getLocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Permissão negada. Libere a localização nas configurações do navegador."
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Não foi possível obter sua localização atual."
  }

  if (error.code === error.TIMEOUT) {
    return "Tempo esgotado ao tentar capturar localização."
  }

  return "Falha ao capturar localização."
}

export default function ClienteLocalizacaoPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [nextPath, setNextPath] = useState("/cliente/barbearias-proximas")

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next")
    if (raw && raw.startsWith("/")) {
      setNextPath(raw)
    }
  }, [])

  async function validateSession() {
    const token = getAccessToken()
    if (!token) {
      setError("Sua sessão expirou. Faça login novamente.")
      return null
    }

    try {
      const context = await fetchMeContext(token)
      if (!context.success) {
        setError("Sua sessão expirou. Faça login novamente.")
        return null
      }
    } catch {
      setError("Não foi possível validar sua sessão.")
      return null
    }

    return token
  }

  async function saveLocation(latitude: number, longitude: number) {
    const token = await validateSession()
    if (!token) return

    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch("/api/me/location", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
        }),
      })

      const result = (await response.json()) as ApiResult<{
        hasLocation: boolean
      }>
      if (!result.success) {
        setError(result.errors?.[0]?.message ?? result.message)
        return
      }

      setInfo("Localização salva com sucesso.")
      router.push(nextPath)
    } catch {
      setError("Falha de conexão ao salvar localização.")
    } finally {
      setLoading(false)
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta geolocalização.")
      return
    }

    setLoading(true)
    setError(null)
    setInfo(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void saveLocation(position.coords.latitude, position.coords.longitude)
      },
      (geoError) => {
        setLoading(false)
        setError(getLocationErrorMessage(geoError))
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
      }
    )
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-3xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(12,16,40,0.96)_100%)] p-6 text-center shadow-[0_36px_90px_rgba(0,0,0,0.62)] md:p-8">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-[#f36c20]/35 bg-[radial-gradient(circle_at_30%_30%,rgba(243,108,32,0.28),rgba(243,108,32,0.08))] text-[#ff7a63]">
          <LocationBlockedIcon />
        </div>

        <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-[38px]">Localização necessária</h1>
        <p className="mx-auto mt-3 max-w-[520px] text-sm leading-relaxed text-[#b9c5eb] md:text-base">
          Precisamos da sua localização para encontrar barbearias perto de você.
        </p>

        {error ? (
          <p className="mt-5 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mt-5 rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
            {info}
          </p>
        ) : null}

        <div className="mx-auto mt-7 max-w-[620px] rounded-2xl border border-white/14 bg-[#0d1537]/80 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-6">
          <h2 className="text-xl font-semibold text-[#dce5ff]">Como ativar:</h2>
          <ol className="mt-4 space-y-3 text-[17px] leading-relaxed text-[#e8edff]">
            <li>
              <span className="font-bold text-[#ffb48f]">1)</span> Clique no{" "}
              <span className="font-semibold text-white">cadeado</span> ao lado do endereço do site.
            </li>
            <li>
              <span className="font-bold text-[#ffb48f]">2)</span> Abra{" "}
              <span className="font-semibold text-white">configurações do site</span>.
            </li>
            <li>
              <span className="font-bold text-[#ffb48f]">3)</span> Selecione{" "}
              <span className="font-semibold text-white">localização</span>.
            </li>
            <li>
              <span className="font-bold text-[#ffb48f]">4)</span> Marque{" "}
              <span className="font-semibold text-white">Permitir</span> e recarregue.
            </li>
          </ol>
        </div>

        <div className="mt-7 flex flex-col items-center gap-3">
          <UIButton
            type="button"
            onClick={requestLocation}
            disabled={loading}
            className="w-full max-w-[320px] !rounded-xl !py-2.5 !text-base !font-semibold !tracking-normal md:!text-lg"
          >
            {loading ? "ATIVANDO..." : "Ativar localização novamente"}
          </UIButton>
          <p className="max-w-[520px] text-sm text-[#aeb8db]">
            Apos permitir nas Configurações do navegador, clique no botao acima.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <Link className="font-semibold text-[#9dbbff] hover:text-white" href="/">
            Voltar para home
          </Link>
        </div>
      </section>
    </main>
  )
}
