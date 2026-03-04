import { AuthContainer } from "@/components/auth/AuthContainer"
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string
  }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const query = await searchParams
  const token = typeof query.token === "string" ? query.token : null

  return (
    <AuthContainer
      title="Defina sua nova senha"
      subtitle="Use o link enviado por email para concluir a recuperacao."
    >
      <ResetPasswordForm token={token} />
    </AuthContainer>
  )
}
