import { verifyToken } from "@/lib/security/jwt"
import { prisma } from "@/lib/db/prisma"
import { failure } from "@/lib/http/api-response"

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return failure("UNAUTHORIZED", "Não autenticado", 401)
  }

  const token = authHeader.split(" ")[1]

  try {
    const payload: any = verifyToken(token)

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return failure("UNAUTHORIZED", "Usuário não encontrado", 401)
    }

    if (user.status !== "ACTIVE") {
      return failure("FORBIDDEN", "Usuário suspenso", 403)
    }

    return user
  } catch {
    return failure("UNAUTHORIZED", "Token inválido ou expirado", 401)
  }
}