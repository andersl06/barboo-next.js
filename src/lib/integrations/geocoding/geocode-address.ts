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

function buildQuery(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(", ")
}

async function geocodeQuery(query: string): Promise<GeocodeData | null> {
  const encodedQuery = encodeURIComponent(query)

  const response = await fetchJson<NominatimResponseItem[]>(
    `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&countrycodes=br`,
    {
      headers: {
        "User-Agent": process.env.GEOCODER_USER_AGENT ?? "barboo/0.1",
      },
    }
  )

  const first = response[0]

  if (!first) {
    return null
  }

  const latitude = Number(first.lat)
  const longitude = Number(first.lon)

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null
  }

  return { latitude, longitude }
}

export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult> {
  const queries = [
    buildQuery([
      input.address,
      input.addressNumber,
      input.neighborhood,
      input.city,
      input.state,
      "Brasil",
      input.zipCode,
    ]),
    buildQuery([
      input.address,
      input.neighborhood,
      input.city,
      input.state,
      "Brasil",
      input.zipCode,
    ]),
    buildQuery([
      input.address,
      input.city,
      input.state,
      "Brasil",
      input.zipCode,
    ]),
    buildQuery([input.zipCode, input.city, input.state, "Brasil"]),
  ]

  try {
    for (const query of queries) {
      const geocode = await geocodeQuery(query)

      if (geocode) {
        return {
          ok: true,
          data: geocode,
        }
      }
    }

    return { ok: false, error: BARBERSHOP_ERRORS.GEOCODING_NOT_FOUND }
  } catch {
    return {
      ok: false,
      error: BARBERSHOP_ERRORS.GEOCODING_SERVICE_UNAVAILABLE,
    }
  }
}
