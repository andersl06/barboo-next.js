"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { BarberShell } from "@/components/barber/BarberShell"
import { UIButton } from "@/components/ui/UIButton"
import {
  clearTempToken,
  getTempToken,
  setAccessToken,
} from "@/lib/client/session"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; code: string; message: string; errors?: ApiErrorDetail[] }

type ChangePasswordData = {
  user: {
    id: string
    name: string
    email: string
  }
}

function translateError(result: Extract<ApiResult<ChangePasswordData>, { success: false }>) {
  const first = result.errors?.[0]?.message
  if (first) return first

  if (result.code === "TEMP_TOKEN_INVALID" || result.code === "UNAUTHORIZED") {
    return "Sessao de primeiro acesso invalida ou expirada. Faca login novamente."
  }

  return result.message || "Nao foi possivel atualizar sua senha."
}

export default function BarberChangePasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (newPassword.trim().length < 6) {
      setError("A nova senha precisa ter no minimo 6 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmacao de senha nao confere.")
      return
    }

    const tempToken = getTempToken()
    if (!tempToken) {
      setError("Sessao de primeiro acesso nao encontrada. Faca login novamente.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      })

      const result = (await response.json()) as ApiResult<ChangePasswordData>
      if (!result.success) {
        setError(translateError(result))
        return
      }

      setAccessToken("cookie-session")
      clearTempToken()
      setSuccessMessage("Senha alterada com sucesso. Redirecionando...")
      window.setTimeout(() => {
        router.replace("/barber/dashboard")
      }, 600)
    } catch {
      setError("Falha de conexao ao alterar senha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <BarberShell
      title="Defina sua nova senha"
      subtitle="Para continuar usando o sistema, voce precisa criar uma nova senha."
      activePath="/barber/change-password"
      hideNavigation
    >
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/12 bg-[#0b1330]/85 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
        {error ? (
          <p className="mb-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="mb-4 rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
            {successMessage}
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm text-[#b8c3e6]">Nova senha</span>
            <input
              className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-[#b8c3e6]">Confirmar nova senha</span>
            <input
              className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <UIButton
            type="submit"
            className="w-full !py-2.5 !text-base md:!py-3"
            disabled={loading}
          >
            {loading ? "Salvando..." : "Alterar senha"}
          </UIButton>
        </form>
      </section>
    </BarberShell>
  )
}
