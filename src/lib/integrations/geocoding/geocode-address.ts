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
  importance?: number
  address?: Record<string, string | undefined>
}

type GeocodeCandidate = GeocodeData & {
  score: number
  importance: number
}

const STATE_NAMES_BY_UF: Record<string, string> = {
  AC: "acre",
  AL: "alagoas",
  AP: "amapa",
  AM: "amazonas",
  BA: "bahia",
  CE: "ceara",
  DF: "distrito federal",
  ES: "espirito santo",
  GO: "goias",
  MA: "maranhao",
  MT: "mato grosso",
  MS: "mato grosso do sul",
  MG: "minas gerais",
  PA: "para",
  PB: "paraiba",
  PR: "parana",
  PE: "pernambuco",
  PI: "piaui",
  RJ: "rio de janeiro",
  RN: "rio grande do norte",
  RS: "rio grande do sul",
  RO: "rondonia",
  RR: "roraima",
  SC: "santa catarina",
  SP: "sao paulo",
  SE: "sergipe",
  TO: "tocantins",
}

function normalizeText(value: string | undefined) {
  if (!value) return ""
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function onlyDigits(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "")
}

function zipMatches(inputZipCode: string, candidateZipCode: string | undefined) {
  const inputZip = onlyDigits(inputZipCode)
  const candidateZip = onlyDigits(candidateZipCode)

  if (inputZip.length !== 8 || candidateZip.length < 5) {
    return { exact: false, partial: false }
  }

  if (candidateZip === inputZip) {
    return { exact: true, partial: true }
  }

  return {
    exact: false,
    partial: candidateZip.slice(0, 5) === inputZip.slice(0, 5),
  }
}

function parseCity(address: Record<string, string | undefined>) {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    ""
  )
}

function stateMatches(inputState: string, address: Record<string, string | undefined>) {
  const normalizedUf = normalizeText(inputState.toUpperCase())
  const stateName = STATE_NAMES_BY_UF[inputState.toUpperCase()]

  const normalizedState = normalizeText(address.state)
  const normalizedStateCode = normalizeText(address["ISO3166-2-lvl4"])

  if (normalizedStateCode.endsWith(`-${normalizedUf}`)) {
    return true
  }

  if (!stateName) {
    return false
  }

  const normalizedStateName = normalizeText(stateName)
  return (
    normalizedState === normalizedStateName ||
    normalizedState.includes(normalizedStateName) ||
    normalizedStateName.includes(normalizedState)
  )
}

function addressMatches(inputAddress: string, address: Record<string, string | undefined>) {
  const candidateRoad = normalizeText(
    address.road ?? address.pedestrian ?? address.footway ?? address.path
  )
  const normalizedInputAddress = normalizeText(inputAddress)

  if (!candidateRoad || !normalizedInputAddress) return false

  return (
    candidateRoad.includes(normalizedInputAddress) ||
    normalizedInputAddress.includes(candidateRoad)
  )
}

function neighborhoodMatches(
  inputNeighborhood: string,
  address: Record<string, string | undefined>
) {
  const normalizedInput = normalizeText(inputNeighborhood)
  const candidateNeighborhood = normalizeText(
    address.neighbourhood ?? address.suburb ?? address.city_district ?? ""
  )

  if (!normalizedInput || !candidateNeighborhood) return false

  return (
    candidateNeighborhood.includes(normalizedInput) ||
    normalizedInput.includes(candidateNeighborhood)
  )
}

function houseNumberMatches(
  inputAddressNumber: string,
  address: Record<string, string | undefined>
) {
  const inputNumber = onlyDigits(inputAddressNumber)
  const candidateNumber = onlyDigits(address.house_number)

  if (!inputNumber || !candidateNumber) return false
  return inputNumber === candidateNumber
}

function scoreCandidate(
  input: GeocodeInput,
  candidate: NominatimResponseItem
): GeocodeCandidate | null {
  const latitude = Number(candidate.lat)
  const longitude = Number(candidate.lon)
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null
  }

  const address = candidate.address ?? {}
  const cityMatch =
    normalizeText(parseCity(address)) === normalizeText(input.city)
  const stateMatch = stateMatches(input.state, address)
  const zipMatch = zipMatches(input.zipCode, address.postcode)
  const roadMatch = addressMatches(input.address, address)
  const houseMatch = houseNumberMatches(input.addressNumber, address)
  const neighborhoodMatch = neighborhoodMatches(input.neighborhood, address)

  let score = 0
  if (cityMatch) score += 4
  if (stateMatch) score += 2
  if (zipMatch.exact) score += 4
  else if (zipMatch.partial) score += 2
  if (roadMatch) score += 3
  if (houseMatch) score += 3
  if (neighborhoodMatch) score += 1

  const acceptable =
    (cityMatch && stateMatch && (zipMatch.partial || roadMatch)) ||
    (zipMatch.exact && (cityMatch || roadMatch)) ||
    (houseMatch && roadMatch && cityMatch)

  if (!acceptable) {
    return null
  }

  return {
    latitude,
    longitude,
    score,
    importance: candidate.importance ?? 0,
  }
}

function buildQuery(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(", ")
}

async function geocodeQuery(query: string): Promise<NominatimResponseItem[]> {
  const encodedQuery = encodeURIComponent(query)

  return fetchJson<NominatimResponseItem[]>(
    `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=jsonv2&addressdetails=1&limit=8&countrycodes=br`,
    {
      headers: {
        "User-Agent": process.env.GEOCODER_USER_AGENT ?? "barboo/0.1",
      },
    }
  )
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
      const candidates = await geocodeQuery(query)

      const bestCandidate = candidates
        .map((candidate) => scoreCandidate(input, candidate))
        .filter((candidate): candidate is GeocodeCandidate => candidate !== null)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          return b.importance - a.importance
        })[0]

      if (bestCandidate) {
        return {
          ok: true,
          data: {
            latitude: bestCandidate.latitude,
            longitude: bestCandidate.longitude,
          },
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
