import { BARBERSHOP_ERRORS } from "@/lib/errors/barbershop-errors"
import { fetchJson, IntegrationHttpError } from "@/lib/integrations/http-client"

export type CnpjLookupData = {
  cnpj: string
  legalName: string
  tradeName?: string
  status: string
}

export type CnpjLookupResult =
  | { ok: true; data: CnpjLookupData }
  | {
      ok: false
      error:
        | typeof BARBERSHOP_ERRORS.CNPJ_NOT_FOUND
        | typeof BARBERSHOP_ERRORS.CNPJ_INACTIVE
        | typeof BARBERSHOP_ERRORS.CNPJ_SERVICE_UNAVAILABLE
    }

type BrasilApiCnpjResponse = {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  descricao_situacao_cadastral: string
}

function normalizeCnpj(cnpj: string) {
  return cnpj.replace(/\D/g, "")
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const normalized = normalizeCnpj(cnpj)

  if (normalized.length !== 14) {
    return { ok: false, error: BARBERSHOP_ERRORS.CNPJ_NOT_FOUND }
  }

  try {
    const response = await fetchJson<BrasilApiCnpjResponse>(
      `https://brasilapi.com.br/api/cnpj/v1/${normalized}`
    )

    const normalizedStatus = response.descricao_situacao_cadastral
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim()

    if (normalizedStatus !== "ATIVA") {
      return { ok: false, error: BARBERSHOP_ERRORS.CNPJ_INACTIVE }
    }

    return {
      ok: true,
      data: {
        cnpj: normalized,
        legalName: response.razao_social,
        tradeName: response.nome_fantasia,
        status: response.descricao_situacao_cadastral,
      },
    }
  } catch (error) {
    if (error instanceof IntegrationHttpError && error.status === 404) {
      return { ok: false, error: BARBERSHOP_ERRORS.CNPJ_NOT_FOUND }
    }

    return { ok: false, error: BARBERSHOP_ERRORS.CNPJ_SERVICE_UNAVAILABLE }
  }
}
