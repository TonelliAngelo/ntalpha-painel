# NT ALPHA — Atualização de publicação

Substituir estes arquivos no projeto:
- `lib/publication-config.ts` (novo)
- `app/api/integracao/validar/route.ts`
- `app/api/integracao/vrsync/route.ts`
- `components/PropertyForm.tsx`
- `app/imoveis/page.tsx`

Regras:
- contato público: NT ALPHA
- telefone/WhatsApp: (11) 99951-7092
- e-mail: nivaldo@ntalpha.com.br
- website: https://www.ntalpha.com.br
- logo: https://www.ntalpha.com.br/images/ntalpha-logo.png
- proprietário, cliente e usuário interno não são usados como contato público
- mínimo 5 JPG/JPEG no feed; máximo 10
- descrição: 50–3000 caracteres; não completar artificialmente
- área útil para imóveis comuns; área total para terreno/lote
- novos nomes de objetos no Storage não usam o nome original enviado pelo usuário
- exclusão de mídia remove registro e objeto físico
- exclusão de imóvel remove as mídias do Storage antes de remover o cadastro

Não executar `schema.sql` antigo novamente em produção.
