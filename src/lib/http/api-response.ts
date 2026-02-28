// src/lib/http/api-response.ts
import { NextResponse } from "next/server"

export type ApiErrorDetail = {
  field?: string | number
  message: string
}

export function success(data: unknown, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  )
}

export function failure(
  code: string,
  message: string,
  status: number,
  errors?: ApiErrorDetail[]
) {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      ...(errors && { errors }),
    },
    { status }
  )
}