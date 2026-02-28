import { BARBERSHOP_ERRORS } from "@/lib/errors/barbershop-errors"
import { fetchJson, IntegrationHttpError } from "@/lib/integrations/http-client"

export type ZipLookupData = {
  zipCode: string
  address: string
  neighborhood: string
  city: string
  state: string
}

export type ZipLookupResult =
  | { ok: true; data: ZipLookupData }
  | {
      ok: false
      error:
        | typeof BARBERSHOP_ERRORS.ZIP_NOT_FOUND
        | typeof BARBERSHOP_ERRORS.ZIP_SERVICE_UNAVAILABLE
    }

type BrasilApiZipResponse = {
  cep: string
  state: string
  city: string
  neighborhood: string
  street: string
}

type ViaCepResponse = {
  cep: string
  uf: string
  localidade: string
  bairro: string
  logradouro: string
  erro?: boolean
}

function normalizeZip(zipCode: string) {
  return zipCode.replace(/\D/g, "")
}

export async function lookupZip(zipCode: string): Promise<ZipLookupResult> {
  const normalized = normalizeZip(zipCode)

  if (normalized.length !== 8) {
    return { ok: false, error: BARBERSHOP_ERRORS.ZIP_NOT_FOUND }
  }

  try {
    const brasilApi = await fetchJson<BrasilApiZipResponse>(
      `https://brasilapi.com.br/api/cep/v1/${normalized}`
    )

    return {
      ok: true,
      data: {
        zipCode: normalized,
        address: brasilApi.street,
        neighborhood: brasilApi.neighborhood,
        city: brasilApi.city,
        state: brasilApi.state,
      },
    }
  } catch (error) {
    if (error instanceof IntegrationHttpError && error.status === 404) {
      return { ok: false, error: BARBERSHOP_ERRORS.ZIP_NOT_FOUND }
    }
  }

  try {
    const viaCep = await fetchJson<ViaCepResponse>(
      `https://viacep.com.br/ws/${normalized}/json/`
    )

    if (viaCep.erro) {
      return { ok: false, error: BARBERSHOP_ERRORS.ZIP_NOT_FOUND }
    }

    return {
      ok: true,
      data: {
        zipCode: normalized,
        address: viaCep.logradouro,
        neighborhood: viaCep.bairro,
        city: viaCep.localidade,
        state: viaCep.uf,
      },
    }
  } catch {
    return { ok: false, error: BARBERSHOP_ERRORS.ZIP_SERVICE_UNAVAILABLE }
  }
}
