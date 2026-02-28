import { NextResponse } from "next/server"

export function success(data: any, status = 200) {
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
  errors?: any[]
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