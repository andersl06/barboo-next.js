export type SupabaseServerConfig = {
  url: string
  serviceRoleKey: string
}

function getEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} não configurado`)
  }

  return value
}

export function getSupabaseServerConfig(): SupabaseServerConfig {
  return {
    url: getEnv("SUPABASE_URL"),
    serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  }
}

export function buildSupabaseHeaders(serviceRoleKey: string, contentType?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  }
}
 
