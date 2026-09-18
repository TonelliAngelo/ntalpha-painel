# Painel NT ALPHA V1
Primeira entrega do painel administrativo separado do site público.

## Incluído
- Tela de login preparada para Supabase Auth
- Dashboard responsivo
- Gestão/listagem de imóveis
- Formulário de cadastro
- Modelagem SQL para properties, imagens e perfis
- RLS inicial
- Estrutura preparada para Nivaldo, Rafael e ADMIN

## Próxima etapa
1. Criar projeto Supabase.
2. Executar `supabase/schema.sql` no SQL Editor.
3. Criar os 3 usuários no Supabase Auth (não gravar senhas no GitHub).
4. Preencher `.env.local` a partir de `.env.example`.
5. Conectar CRUD, Storage e dashboard aos dados reais.
6. Integrar o site público somente aos imóveis `publicar_site=true` e `status=disponivel`.

O DNS do domínio oficial não precisa ser alterado nesta fase.
