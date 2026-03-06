import type { ReactNode } from "react"
import { BarberRouteGuard } from "@/components/barber/BarberRouteGuard"

export default function BarberLayout({ children }: { children: ReactNode }) {
  return <BarberRouteGuard>{children}</BarberRouteGuard>
}

