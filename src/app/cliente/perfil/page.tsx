"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useState } from "react"
import { PremiumBackground } from "@/components/background"
import { UIButton } from "@/components/ui/UIButton"
import { getAccessToken } from "@/lib/client/session"

type ApiErrorDetail = {
  field?: string | number
  message: string
}

type ApiFailure = {
  success: false
  code: string
  message: string
  errors?: ApiErrorDetail[]
}

type ApiResult<T> = { success: true; data: T } | ApiFailure

type MeData = {
  id: string
  name: string
  email: string
  phone: string | null
}

type ScreenState = "loading" | "unauthenticated" | "ready"

function resolveErrorMessage(result: ApiFailure) {
  return result.errors?.[0]?.message ?? result.message
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
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

export default function ClientePerfilPage() {
  const [screen, setScreen] = useState<ScreenState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const loadProfile = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })
      const result = (await response.json()) as ApiResult<MeData>

      if (!result.success) {
        setError(resolveErrorMessage(result))
        return
      }

      setName(result.data.name)
      setPhone(formatPhone(result.data.phone ?? ""))
      setEmail(result.data.email)
      setScreen("ready")
    } catch {
      setError("Falha de conexão ao carregar perfil.")
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProfile])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setSavingProfile(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
        }),
      })
      const result = (await response.json()) as ApiResult<MeData>

      if (!result.success) {
        setError(resolveErrorMessage(result))
        return
      }

      setName(result.data.name)
      setPhone(formatPhone(result.data.phone ?? ""))
      setSuccess("Dados pessoais atualizados com sucesso.")
    } catch {
      setError("Falha de conexão ao salvar dados pessoais.")
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = getAccessToken()
    if (!token) {
      setScreen("unauthenticated")
      return
    }

    setSavingPassword(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/me/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
      const result = (await response.json()) as ApiResult<{ changed: boolean }>

      if (!result.success) {
        setError(resolveErrorMessage(result))
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccess("Senha alterada com sucesso.")
    } catch {
      setError("Falha de conexão ao alterar senha.")
    } finally {
      setSavingPassword(false)
    }
  }

  if (screen === "unauthenticated") {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
        <PremiumBackground />
        <section className="relative z-10 mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#0d1434]/80 p-6 text-center">
          <p className="text-[#d0d7ef]">Você precisa fazer login para acessar seu perfil.</p>
          <Link className="mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2" href="/login">
            Ir para login
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#070B16] px-4 py-8 text-[#f1f2f7] md:px-8 md:py-12">
      <PremiumBackground />
      <section className="relative z-10 mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,54,0.9)_0%,rgba(13,17,41,0.94)_100%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-6">
        <h1 className="text-3xl font-bold">Meu perfil</h1>
        <p className="mt-1 text-sm text-[#a7b1d0] md:text-base">
          Edite seus dados de contato e seguranca.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/12 px-3.5 py-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-300/35 bg-emerald-500/12 px-3.5 py-2.5 text-sm text-emerald-100">
            {success}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4">
          <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
            <h2 className="text-lg font-semibold">Dados pessoais</h2>
            <form className="mt-4 grid gap-3" onSubmit={saveProfile}>
              <label className="block">
                <span className="mb-1 block text-sm text-[#b8c3e6]">Nome</span>
                <input
                  className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-[#b8c3e6]">Telefone</span>
                <input
                  className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition placeholder:text-[#8796c5] focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                  value={phone}
                  onChange={(event) => setPhone(formatPhone(event.target.value))}
                  placeholder="(11) 99999-0000"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-[#b8c3e6]">Email</span>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-[#0b153c]/55 px-3 py-2.5 text-base text-[#aebbe2]"
                />
              </label>

              <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingProfile}>
                {savingProfile ? "Salvando..." : "Salvar"}
              </UIButton>
            </form>
          </article>

          <article className="rounded-2xl border border-white/12 bg-[#0b1330]/85 p-4">
            <h2 className="text-lg font-semibold">Seguranca</h2>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={changePassword}>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm text-[#b8c3e6]">Senha atual</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-[#b8c3e6]">Nova senha</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                  minLength={6}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-[#b8c3e6]">Confirmar nova senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-[#0b153c]/88 px-3 py-2.5 text-base text-[#f4f6ff] outline-none transition focus:border-[#3f77f5] focus:ring-2 focus:ring-[#3f77f5]/30"
                  minLength={6}
                  required
                />
              </label>

              <div className="sm:col-span-2">
                <UIButton type="submit" className="!w-auto !px-4 !py-2 !text-sm" disabled={savingPassword}>
                  {savingPassword ? "Alterando..." : "Alterar senha"}
                </UIButton>
              </div>
            </form>
          </article>
        </div>
      </section>
    </main>
  )
}

