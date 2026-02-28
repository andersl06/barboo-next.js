import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET as string

export type JwtPayload = {
  userId: string
}

export function generateToken(userId: string) {
  const payload: JwtPayload = { userId }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}