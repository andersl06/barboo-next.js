"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useMemo, useState } from "react"
import { UIButton } from "@/components/ui/UIButton"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; code: string; message: string; errors?: ApiErrorDetail[] }

type ResetPasswordResponse = {
  message: string
}

type ResetPasswordFormProps = {
  token: string | null
}

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-[#090f26]/85 px-3.5 py-3 text-[#f4f6ff] outline-none transition placeholder:text-[#7e88ab] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"

function translateError(result: Extract<ApiResult<ResetPasswordResponse>, { success: false }>) {
  if (result.code === "VALIDATION_ERROR") {
    return result.errors?.[0]?.message ?? "Dados invalidos. Revise os campos."
  }

  if (result.code === "RESET_TOKEN_INVALID_OR_EXPIRED") {
    return "Seu link de recuperacao e invalido ou expirou."
  }

  if (result.code === "TOO_MANY_ATTEMPTS" || result.code === "RATE_LIMIT") {
    return "Muitas tentativas. Aguarde alguns minutos para tentar novamente."
  }

  return result.message || "Nao foi possivel redefinir a senha."
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const hasToken = useMemo(() => Boolean(token && token.trim().length >= 32), [token])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!hasToken || !token) {
      setError("Token de recuperacao ausente ou invalido.")
      return
    }

    if (password.length < 6) {
      setError("A senha precisa ter no minimo 6 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("A confirmacao de senha nao confere.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      })

      const result = (await response.json()) as ApiResult<ResetPasswordResponse>
      if (!result.success) {
        setError(translateError(result))
        return
      }

      setSuccessMessage(result.data.message)
      window.setTimeout(() => {
        router.replace("/login?reset=1")
      }, 700)
    } catch {
      setError("Falha de conexao. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (!hasToken) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          O link de recuperacao e invalido ou incompleto.
        </p>
        <p className="text-sm text-[#a8b3d9]">
          Solicite um novo link em{" "}
          <Link className="font-semibold text-[#8db0ff] hover:text-[#b0c8ff]" href="/auth/forgot-password">
            Esqueci minha senha
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error ? (
        <p className="rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
          {successMessage}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
          Nova senha
        </span>
        <input
          className={inputClassName}
          type="password"
          value={password}
          placeholder="Minimo de 6 caracteres"
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#b7c2e6]">
          Confirmar nova senha
        </span>
        <input
          className={inputClassName}
          type="password"
          value={confirmPassword}
          placeholder="Repita a nova senha"
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={6}
          required
        />
      </label>

      <UIButton type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : "Alterar senha"}
      </UIButton>

      <p className="text-sm text-[#a8b3d9]">
        Voltar para{" "}
        <Link className="font-semibold text-[#8db0ff] hover:text-[#b0c8ff]" href="/login">
          Login
        </Link>
      </p>
    </form>
  )
}
