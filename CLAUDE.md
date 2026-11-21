# Regras deste repositório

Repositório PÚBLICO de skills da Norama. Cada skill fica em `skills/<nome>/SKILL.md`.

## Ao adicionar ou alterar uma skill
1. `name` no cabeçalho do SKILL.md = nome da pasta (minúsculas, hífen).
2. Atualize o `README.md`: linha no **Índice** + seção `## <nome>` com "O que faz", "Exemplos de pedido",
   "Observações" e "Créditos" (se houver código de terceiros, mantenha LICENSE/NOTICE dele na pasta).
3. Revise antes de commitar: sem dados de clientes, nomes de candidatos/clientes, estratégia privada, e-mails,
   senhas, tokens ou chaves. Skills com dados de cliente vão para um repositório privado, nunca aqui.
4. Não commitar `node_modules/`, saídas de render (`simulator-out/`) nem .zip.

## Usar as skills numa sessão do Claude Code aberta com este repo
As skills ficam em `skills/`. Para o Claude Code carregar automaticamente, `.claude/skills` é um link para `skills/`.
