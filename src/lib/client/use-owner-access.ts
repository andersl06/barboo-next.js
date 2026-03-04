"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchMeContext, getAccessToken } from "@/lib/client/session"

export type OwnerAccessState =
  | "loading"
  | "unauthenticated"
  | "no_barbershop"
  | "ready"

type OwnerAccessData = {
  state: OwnerAccessState
  error: string | null
  token: string | null
  userName: string | null
  ownerBarbershopId: string | null
  barbershopStatus: string | null
}

const INITIAL_STATE: OwnerAccessData = {
  state: "loading",
  error: null,
  token: null,
  userName: null,
  ownerBarbershopId: null,
  barbershopStatus: null,
}

export function useOwnerAccess() {
  const [data, setData] = useState<OwnerAccessData>(INITIAL_STATE)

  const loadOwnerAccess = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setData({
        state: "unauthenticated",
        error: "Sessao nao encontrada.",
        token: null,
        userName: null,
        ownerBarbershopId: null,
        barbershopStatus: null,
      })
      return
    }

    try {
      const context = await fetchMeContext(token)
      if (!context.success) {
        setData({
          state: "unauthenticated",
          error: context.message,
          token: null,
          userName: null,
          ownerBarbershopId: null,
          barbershopStatus: null,
        })
        return
      }

      if (!context.data.ownerBarbershopId) {
        setData({
          state: "no_barbershop",
          error: null,
          token,
          userName: context.data.user.name,
          ownerBarbershopId: null,
          barbershopStatus: context.data.barbershopStatus,
        })
        return
      }

      setData({
        state: "ready",
        error: null,
        token,
        userName: context.data.user.name,
        ownerBarbershopId: context.data.ownerBarbershopId,
        barbershopStatus: context.data.barbershopStatus,
      })
    } catch {
      setData({
        state: "unauthenticated",
        error: "Nao foi possivel validar sua sessao.",
        token: null,
        userName: null,
        ownerBarbershopId: null,
        barbershopStatus: null,
      })
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOwnerAccess()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadOwnerAccess])

  return {
    ...data,
    reloadAccess: loadOwnerAccess,
  }
}

