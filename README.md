# Norama Skills

Skills para o **Claude** (claude.ai e Claude Code) criadas pela Norama para o dia a dia de **criação de conteúdo,
vídeo, marketing e tráfego pago**. Cada skill é uma pasta com um `SKILL.md`: instruções que o Claude carrega sozinho
quando o pedido combina com ela.

Gratuitas e abertas. Use, adapte e compartilhe.

## Índice

| Skill | Para que serve | Precisa de |
|---|---|---|
| [assistir](#assistir) | Assiste Reels/vídeos de verdade: baixa, tira quadros, transcreve a fala e analisa | ffmpeg, Python 3 |
| [maquete-3d](#maquete-3d) | Cria maquetes 3D animadas e explicativas e grava em MP4 para vídeos | Node 20+, ffmpeg, Python 3 |
| [meta-ads-politico](#meta-ads-politico) | Tráfego pago no Meta Ads para campanhas políticas regionais | — |

---

## assistir

**O que faz:** você cola o link de um Reel do Instagram (ou envia um .mp4/.mov) e pede "assiste aí". O Claude baixa
o vídeo, gera mosaicos com 1 quadro a cada 3 s, transcreve a fala em português (faster-whisper) e lê a legenda.
Depois responde: o que o vídeo mostra de fato, se é verdade / dá para fazer, e se vale para o seu projeto.

**Exemplos de pedido:**
- "Assiste esse reel e vê se é verdade: instagram.com/reel/..."
- "Esse vídeo fala de uma ferramenta, dá pra gente usar?"

**Observações:** a primeira transcrição baixa o modelo (~500 MB). Posts privados/removidos não baixam: envie o arquivo.

## maquete-3d

**O que faz:** transforma um trecho de roteiro em uma **maquete 3D em miniatura** (estilo brinquedo, isométrica,
tudo em código, sem arquivo 3D) com um "herói" seguido do início ao fim — um pedido, um entregador, um caminhão, um
documento — e grava em MP4 (9:16, 4:5 ou 16:9) para entrar como trecho de Reels, vídeos-história e anúncios.

**Pacotes incluídos:** catálogo geral (bonequinhos, cidade, lojas, moto, celular gigante com app), produtos e
serviços (delivery, como o app funciona, antes x depois), pacote regional do Amazonas (rios, balsa, BR-319) e
regras para peças políticas (rótulo de IA).

**Exemplos de pedido:**
- "Faz uma maquete 3D do caminho de um pedido de delivery, 20 s em 9:16"
- "Quero um 3D da BR-319 mostrando o trecho do meio para um vídeo-história"

**Não é para:** sites, imagens estáticas, pessoas realistas.

**Créditos:** motor 3D [Simulator](https://github.com/Nyxera0x/simulator) por Nyxera0x (MIT), em
`skills/maquete-3d/engine/`.

## meta-ads-politico

**O que faz:** atua como especialista de tráfego pago no Meta Ads para campanhas políticas, com foco em estados
grandes e públicos de nicho regional (ribeirinhos, agricultores, pescadores, garimpo etc.). Lê prints do Gerenciador
de Anúncios, diagnostica CPM/CTR/frequência e sugere segmentações e ajustes para baratear e ampliar o alcance.

**Exemplos de pedido:**
- "Olha esse print do Gerenciador, por que o CPM está tão alto?"
- "Como eu chego em pescadores do interior no Meta?"

---

## Como instalar

**claude.ai (todas as conversas):** baixe a pasta da skill como .zip (ou use o botão *Code → Download ZIP* e
compacte só a pasta desejada) e envie em **Configurações → Capacidades → Skills → Enviar skill**.

**Claude Code (terminal):**
```bash
npx skills add RaphaelRezendeDesigner/norama-skills --skill <nome-da-skill> -a claude-code
# ou manualmente
git clone https://github.com/RaphaelRezendeDesigner/norama-skills && cp -r norama-skills/skills/<nome-da-skill> ~/.claude/skills/
```

**Sessões do Claude Code na web:** abra a conversa com este repositório selecionado; as skills de
`.claude/skills/` são carregadas automaticamente (ver `CLAUDE.md`).

## Adicionar uma skill nova

1. Crie `skills/<nome-em-minusculas-com-hifen>/SKILL.md` com o cabeçalho `name` e `description`.
2. Adicione uma linha no **Índice** e uma seção **## <nome>** neste README (o que faz, exemplos de pedido,
   observações, créditos se usar código de terceiros).
3. Nada de dados de clientes, senhas, tokens ou estratégia privada: este repositório é público.

## Licença

MIT (ver `LICENSE`). Código de terceiros mantém a licença original indicada na própria pasta.
