import jwt from "jsonwebtoken"

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret || jwtSecret.trim().length === 0) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED")
  }

  return jwtSecret
}

export type TokenType = "access" | "temp"

export type JwtPayload = {
  userId: string
  type?: TokenType
}

export function generateToken(userId: string) {
  const payload: JwtPayload = { userId, type: "access" }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "7d",
  })
}

export function generateTempToken(userId: string) {
  const payload: JwtPayload = { userId, type: "temp" }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "15m",
  })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload
}
