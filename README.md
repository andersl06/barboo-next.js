💈 Barboo

Plataforma SaaS para gestão e agendamento online de barbearias.

O Barboo conecta clientes a barbearias próximas, permitindo busca por geolocalização, visualização de serviços, escolha de barbeiro e agendamento em tempo real.
Além disso, oferece um painel administrativo completo para gestão operacional da barbearia.

🎯 Objetivo do Projeto

Criar um sistema moderno e escalável que permita:

📍 Descoberta de barbearias por localização

📅 Agendamento online com cálculo inteligente de disponibilidade

👤 Gestão de barbeiros e serviços

🏪 Estrutura multi-tenant (várias barbearias no mesmo sistema)

💰 Modelo de monetização via comissão/faturas (em desenvolvimento)

🏗 Arquitetura
Backend

Node.js

Prisma ORM

PostgreSQL

JWT para autenticação

Estrutura multi-tenant via Membership

Banco de Dados

Principais entidades:

User → Autenticação

Barbershop → Barbearia

Membership → Relaciona usuário à barbearia (OWNER / BARBER)

BarberProfile → Perfil profissional do barbeiro

Category → Categorias de serviço

Service → Serviços oferecidos

Appointment → Agendamentos

🔐 Sistema de Autenticação

Registro com validação de dados

Senha criptografada

JWT com expiração

Middleware de proteção

Estrutura multi-tenant

Controle por Membership (não por role global)

🏪 Módulo Barbearia
Onboarding

Criação da barbearia

Endereço completo

Geolocalização (latitude/longitude)

URL personalizada

Upload de logo e capa

Definição se o owner atua como barbeiro

Estrutura Operacional

Categorias

Serviços

Vinculação de serviços ao barbeiro

Horários de funcionamento

Horários individuais por barbeiro

📍 Experiência do Cliente

Solicitação de geolocalização

Busca por barbearias próximas

Página pública da barbearia

Seleção de serviço

Seleção de barbeiro

Seleção de horário

Agendamento

Cancelamento com regra de 30 minutos

👨‍🔧 Experiência do Barbeiro

Dashboard com agenda do dia

Visualização de próximos atendimentos

Marcar como concluído

Marcar como não compareceu

Criar agendamento manual para clientes presenciais

⚙️ Status do Projeto
✅ Concluído

Estrutura inicial do banco

Conexão com PostgreSQL via Docker

Prisma configurado

Registro de usuário

Estrutura multi-tenant base

🚧 Em desenvolvimento

Login robusto

Onboarding completo da barbearia

Sistema de disponibilidade

Fluxo completo de agendamento

🔜 Planejado

Realtime para agenda

Sistema financeiro (comissão e faturas)

Avaliações

Notificações

Dashboard analítico

🧠 Conceitos Técnicos Importantes
Multi-tenant

Cada usuário pode pertencer a uma ou mais barbearias via Membership.
Permissões não ficam no usuário, mas na relação com a barbearia.

Disponibilidade Inteligente

O sistema de agenda considera:

Horário da barbearia

Horário individual do barbeiro

Bloqueios

Duração do serviço

Sobreposição de agendamentos

🚀 Como rodar o projeto
1️⃣ Subir banco via Docker
docker run --name barboo-postgres \
-e POSTGRES_USER=postgres \
-e POSTGRES_PASSWORD=postgres \
-e POSTGRES_DB=barboo \
-p 5432:5432 \
-d postgres:15
2️⃣ Configurar .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barboo"
JWT_SECRET="sua_chave_secreta"
3️⃣ Sincronizar banco
npx prisma db push
4️⃣ Rodar projeto
npm run dev
🗺 Roadmap (Visão Macro)

Finalizar fluxo de agendamento

Implementar realtime

Criar dashboard do barbeiro

Estruturar financeiro

Implementar avaliações

Lançar versão beta
