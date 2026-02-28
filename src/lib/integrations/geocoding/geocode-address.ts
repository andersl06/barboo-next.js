import { BARBERSHOP_ERRORS } from "@/lib/errors/barbershop-errors"
import { fetchJson } from "@/lib/integrations/http-client"

export type GeocodeInput = {
  address: string
  addressNumber: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

export type GeocodeData = {
  latitude: number
  longitude: number
}

export type GeocodeResult =
  | { ok: true; data: GeocodeData }
  | {
      ok: false
      error:
        | typeof BARBERSHOP_ERRORS.GEOCODING_NOT_FOUND
        | typeof BARBERSHOP_ERRORS.GEOCODING_SERVICE_UNAVAILABLE
    }

type NominatimResponseItem = {
  lat: string
  lon: string
}

function buildQuery(input: GeocodeInput) {
  return [
    input.address,
    input.addressNumber,
    input.neighborhood,
    input.city,
    input.state,
    "Brasil",
    input.zipCode,
  ]
    .filter(Boolean)
    .join(", ")
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult> {
  const query = encodeURIComponent(buildQuery(input))

  try {
    const response = await fetchJson<NominatimResponseItem[]>(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
      {
        headers: {
          "User-Agent": process.env.GEOCODER_USER_AGENT ?? "barboo/0.1",
        },
      }
    )

    const first = response[0]

    if (!first) {
      return { ok: false, error: BARBERSHOP_ERRORS.GEOCODING_NOT_FOUND }
    }

    const latitude = Number(first.lat)
    const longitude = Number(first.lon)

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return { ok: false, error: BARBERSHOP_ERRORS.GEOCODING_NOT_FOUND }
    }

    return {
      ok: true,
      data: { latitude, longitude },
    }
  } catch {
    return {
      ok: false,
      error: BARBERSHOP_ERRORS.GEOCODING_SERVICE_UNAVAILABLE,
    }
  }
}
