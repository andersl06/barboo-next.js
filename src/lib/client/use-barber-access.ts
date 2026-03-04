"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchMeContext, getAccessToken, getTempToken } from "@/lib/client/session"

export type BarberAccessState =
  | "loading"
  | "unauthenticated"
  | "must_change_password"
  | "forbidden"
  | "no_barbershop"
  | "ready"

type BarberAccessData = {
  state: BarberAccessState
  error: string | null
  token: string | null
  userId: string | null
  userName: string | null
  barbershopId: string | null
  barbershopStatus: string | null
}

const INITIAL_STATE: BarberAccessData = {
  state: "loading",
  error: null,
  token: null,
  userId: null,
  userName: null,
  barbershopId: null,
  barbershopStatus: null,
}

export function useBarberAccess() {
  const [data, setData] = useState<BarberAccessData>(INITIAL_STATE)

  const loadBarberAccess = useCallback(async () => {
    const token = getAccessToken()
    const tempToken = getTempToken()

    if (tempToken && !token) {
      setData({
        ...INITIAL_STATE,
        state: "must_change_password",
        error: null,
      })
      return
    }

    if (!token) {
      setData({
        ...INITIAL_STATE,
        state: "unauthenticated",
        error: "Sessao nao encontrada.",
      })
      return
    }

    try {
      const context = await fetchMeContext(token)
      if (!context.success) {
        if (tempToken) {
          setData({
            ...INITIAL_STATE,
            state: "must_change_password",
            error: null,
          })
          return
        }

        setData({
          ...INITIAL_STATE,
          state: "unauthenticated",
          error: context.message,
        })
        return
      }

      if (
        context.data.effectiveRole !== "BARBER"
        && context.data.effectiveRole !== "OWNER"
      ) {
        setData({
          ...INITIAL_STATE,
          state: "forbidden",
          error: "Acesso permitido apenas para barbeiros.",
        })
        return
      }

      const barbershopId =
        context.data.barberBarbershopId ?? context.data.ownerBarbershopId

      if (!barbershopId) {
        setData({
          ...INITIAL_STATE,
          state: "no_barbershop",
          error: "Nenhuma barbearia vinculada ao seu perfil.",
          token,
          userId: context.data.user.id,
          userName: context.data.user.name,
          barbershopStatus: context.data.barbershopStatus,
        })
        return
      }

      setData({
        ...INITIAL_STATE,
        state: "ready",
        error: null,
        token,
        userId: context.data.user.id,
        userName: context.data.user.name,
        barbershopId,
        barbershopStatus: context.data.barbershopStatus,
      })
    } catch {
      setData({
        ...INITIAL_STATE,
        state: "unauthenticated",
        error: "Nao foi possivel validar sua sessao.",
      })
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBarberAccess()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadBarberAccess])

  return {
    ...data,
    reloadAccess: loadBarberAccess,
  }
}

