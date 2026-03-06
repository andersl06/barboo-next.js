"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { UIButton } from "@/components/ui/UIButton"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; code: string; message: string; errors?: ApiErrorDetail[] }

type ForgotPasswordResponse = {
  message: string
}

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-[#090f26]/85 px-3.5 py-3 text-[#f4f6ff] outline-none transition placeholder:text-[#7e88ab] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function translateError(result: Extract<ApiResult<ForgotPasswordResponse>, { success: false }>) {
  if (result.code === "VALIDATION_ERROR") {
    return result.errors?.[0]?.message ?? "Informe um email valido."
  }

  if (result.code === "TOO_MANY_ATTEMPTS" || result.code === "RATE_LIMIT") {
    return "Muitas tentativas. Aguarde alguns minutos para tentar novamente."
  }

  return "Não foi possível enviar o link agora. Tente novamente."
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const result = (await response.json()) as ApiResult<ForgotPasswordResponse>
      if (!result.success) {
        setError(translateError(result))
        return
      }

      setInfo(result.data.message)
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

      {info ? (
        <p className="rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
          {info}
        </p>
      ) : null}

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

      <UIButton type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link de recuperação"}
      </UIButton>

      <p className="text-sm text-[#a8b3d9]">
        Lembrou a senha?{" "}
        <Link className="font-semibold text-[#8db0ff] hover:text-[#b0c8ff]" href="/login">
          Voltar para login
        </Link>
      </p>
    </form>
  )
}
