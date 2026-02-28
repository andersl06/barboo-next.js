export class IntegrationHttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = "IntegrationHttpError"
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 6000
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new IntegrationHttpError(
        `HTTP ${response.status} when calling ${url}`,
        response.status
      )
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}
