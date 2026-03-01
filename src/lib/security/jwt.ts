import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET as string

export type TokenType = "access" | "temp"

export type JwtPayload = {
  userId: string
  type?: TokenType
}

export function generateToken(userId: string) {
  const payload: JwtPayload = { userId, type: "access" }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  })
}

export function generateTempToken(userId: string) {
  const payload: JwtPayload = { userId, type: "temp" }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "15m",
  })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}