"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { UIButton } from "@/components/ui/UIButton"
import {
  clearTempToken,
  fetchMeContext,
  setAccessToken,
  setTempToken,
} from "@/lib/client/session"

type LoginResponseData = {
  mustChangePassword: boolean
  token?: string
  tempToken?: string
}

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; code: string; message: string; errors?: ApiErrorDetail[] }

type LoginFormProps = {
  registered?: boolean
  nextPath?: string | null
}

function resolveNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/")) {
    return "/"
  }

  return raw
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function translateLoginError(result: Extract<ApiResult<LoginResponseData>, { success: false }>) {
  if (result.code === "INVALID_CREDENTIALS") {
    return "Email ou senha invalidos."
  }

  if (result.code === "TOO_MANY_ATTEMPTS" || result.code === "RATE_LIMIT") {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  }

  if (result.code === "VALIDATION_ERROR") {
    const first = result.errors?.[0]?.message
    if (first) {
      return first
    }

    return "Dados invalidos. Revise os campos e tente novamente."
  }

  if (result.code === "UNAUTHORIZED") {
    return "Sessao invalida. Faca login novamente."
  }

  return "Nao foi possivel concluir o login agora."
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m5 7 6.15 4.1a1.5 1.5 0 0 0 1.7 0L19 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M7 10.5A2.5 2.5 0 0 1 9.5 8h5A2.5 2.5 0 0 1 17 10.5v7A2.5 2.5 0 0 1 14.5 20h-5A2.5 2.5 0 0 1 7 17.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 8V6.8A3 3 0 0 1 12 4a3 3 0 0 1 3 2.8V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LoginForm({ registered = false, nextPath }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const successHint = registered
    ? "Conta criada com sucesso. Entre para continuar."
    : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const result = await response.json() as ApiResult<LoginResponseData>
      if (!result.success) {
        setError(translateLoginError(result))
        return
      }

      if (result.data.mustChangePassword && result.data.tempToken) {
        setTempToken(result.data.tempToken)
        router.push("/barber/change-password")
        return
      }

      if (!result.data.token) {
        setError("Nao foi possivel concluir o login.")
        return
      }

      setAccessToken(result.data.token)
      clearTempToken()

      const context = await fetchMeContext(result.data.token)
      const explicitNextPath = resolveNextPath(nextPath ?? null)
      const hasExplicitNext = Boolean(nextPath && nextPath.startsWith("/"))

      if (hasExplicitNext) {
        router.push(explicitNextPath)
        return
      }

      if (context.success) {
        if (context.data.ownerBarbershopId) {
          router.push("/owner/dashboard")
          return
        }

        if (context.data.onboardingPending) {
          router.push("/onboarding/proprietario")
          return
        }

        if (context.data.effectiveRole === "CLIENT") {
          if (!context.data.hasClientLocation) {
            router.push("/cliente/localizacao?next=%2Fcliente%2Fbarbearias-proximas")
            return
          }

          router.push("/cliente/barbearias-proximas")
          return
        }

        if (context.data.effectiveRole === "BARBER") {
          router.push("/barber/dashboard")
          return
        }
      }

      router.push(explicitNextPath)
    } catch {
      setError("Falha de conexao. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {successHint ? (
        <p className="rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
          {successHint}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <label className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7f8dbd]">
          <MailIcon />
        </span>
        <input
          className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 py-3 pl-11 pr-3 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
          type="email"
          value={email}
          placeholder="Seu E-mail"
          onChange={(event) => setEmail(normalizeEmail(event.target.value))}
          required
        />
      </label>

      <label className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7f8dbd]">
          <LockIcon />
        </span>
        <input
          className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 py-3 pl-11 pr-3 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
          type="password"
          value={password}
          placeholder="Sua Senha"
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <div className="text-right">
        <button
          type="button"
          className="text-sm text-[#c6d0ee] transition hover:text-white"
        >
          Esqueceu a senha?
        </button>
      </div>

      <UIButton
        type="submit"
        className="w-full !py-2.5 !text-base !font-semibold !text-white tracking-[0.02em] md:!py-3 md:!text-lg"
        disabled={loading}
      >
        {loading ? "ENTRANDO..." : "ENTRAR"}
      </UIButton>

      <div className="mt-2 flex items-center gap-3 text-sm text-[#aeb8db]">
        <span className="h-px flex-1 bg-white/20" />
        <span>Nao tem uma conta?</span>
        <Link className="font-semibold text-[#dbe4ff] hover:text-white" href="/cadastro">
          Cadastre-se
        </Link>
        <span className="h-px flex-1 bg-white/20" />
      </div>
    </form>
  )
}
