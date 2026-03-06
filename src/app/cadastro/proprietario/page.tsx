import { AuthContainer } from "@/components/auth/AuthContainer"
import { RegisterForm } from "@/components/auth/RegisterForm"

export default function CadastroProprietarioPage() {
  return (
    <AuthContainer title="Cadastro de proprietário">
      <RegisterForm onboardingIntent="OWNER" />
    </AuthContainer>
  )
}
