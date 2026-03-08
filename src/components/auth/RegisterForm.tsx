"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { UIButton } from "@/components/ui/UIButton"

type RegisterIntent = "CLIENT" | "OWNER"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; code: string; message: string; errors?: ApiErrorDetail[] }

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-[#090f26]/85 px-3.5 py-3 text-[#f4f6ff] outline-none transition placeholder:text-[#7e88ab] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function applyCpfMask(value: string) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function applyPhoneMask(value: string) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function translateRegisterError(result: Extract<ApiResult<{ id: string }>, { success: false }>) {
  if (result.code === "RATE_LIMIT") {
    return "Muitas tentativas de cadastro. Aguarde alguns minutos."
  }

  if (result.code === "DUPLICATE") {
    const field = typeof result.errors?.[0]?.field === "string"
      ? result.errors?.[0]?.field
      : undefined

    if (field === "email") {
      return "Este email Já esta cadastrado."
    }

    if (field === "cpf") {
      return "Este CPF Já esta cadastrado."
    }

    if (field === "phone") {
      return "Este telefone Já esta cadastrado."
    }

    return "Já existe um cadastro com estes dados."
  }

  if (result.code === "VALIDATION_ERROR") {
    const first = result.errors?.[0]?.message
    if (first) {
      return first
    }

    return "Dados invalidos. Revise os campos."
  }

  return "Não foi possível concluir o cadastro agora."
}

export function RegisterForm({ onboardingIntent }: { onboardingIntent: RegisterIntent }) {
  const router = useRouter()
  const shouldShowCpf = onboardingIntent === "OWNER"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("As senhas não conferem.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          cpf: shouldShowCpf ? (onlyDigits(cpf) || undefined) : undefined,
          phone: onlyDigits(phone),
          password,
          onboardingIntent,
        }),
      })

      const result = await response.json() as ApiResult<{ id: string }>
      if (!result.success) {
        setError(translateRegisterError(result))
        return
      }

      const next = onboardingIntent === "OWNER"
        ? "/onboarding/proprietario"
        : "/cliente/localizacao?next=%2Fcliente%2Fbarbearias-proximas"
      router.push(`/login?registered=1&next=${encodeURIComponent(next)}`)
    } catch {
      setError("Falha de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
          Nome completo
        </span>
        <input
          className={inputClassName}
          type="text"
          value={name}
          placeholder="Ex: Anderson Linhares"
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
          Email
        </span>
        <input
          className={inputClassName}
          type="email"
          value={email}
          placeholder="Você@email.com"
          onChange={(event) => setEmail(normalizeEmail(event.target.value))}
          required
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shouldShowCpf ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
              CPF (opcional)
            </span>
            <input
              className={inputClassName}
              type="text"
              inputMode="numeric"
              value={cpf}
              placeholder="000.000.000-00"
              onChange={(event) => setCpf(applyCpfMask(event.target.value))}
            />
          </label>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
            Telefone
          </span>
          <input
            className={inputClassName}
            type="text"
            inputMode="numeric"
            value={phone}
            placeholder="(00) 00000-0000"
            onChange={(event) => setPhone(applyPhoneMask(event.target.value))}
            required
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
            Senha
          </span>
          <input
            className={inputClassName}
            type="password"
            value={password}
            placeholder="mínimo de 6 caracteres"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
            Confirmar senha
          </span>
          <input
            className={inputClassName}
            type="password"
            value={confirmPassword}
            placeholder="Repita sua senha"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
      </div>

      <UIButton type="submit" className="mt-1 w-full" disabled={loading}>
        {loading ? "Criando conta..." : "Criar conta"}
      </UIButton>

      <p className="text-sm text-[#a8b3d9]">
        Já possui conta?{" "}
        <Link className="font-semibold text-[#8db0ff] hover:text-[#b0c8ff]" href="/login">
          Fazer login
        </Link>
      </p>
    </form>
  )
}
