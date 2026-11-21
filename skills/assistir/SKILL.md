---
name: assistir
description: Assiste a vídeos de verdade (Reels/posts do Instagram ou arquivo de vídeo enviado) — baixa o vídeo, extrai quadros para ver as imagens, transcreve a fala em português e lê legenda/autor — e depois analisa. Use SEMPRE que o usuário mandar um link do Instagram (instagram.com/reel/, /p/, /tv/) ou um arquivo .mp4/.mov e pedir para "assistir", "ver", "analisar", "ver se é verdade", "ver se dá pra fazer", "o que esse vídeo fala", ou simplesmente colar o link de um reel sem mais nada. Também quando o usuário reclamar que "não está conseguindo assistir".
---

# Assistir vídeos

O objetivo é ver e ouvir o vídeo de fato. Não analise só pela legenda quando dá para assistir.

## Passo 1: rodar o script

Para cada link ou arquivo, rode (pode passar vários de uma vez):

```bash
bash "<pasta-desta-skill>/scripts/assistir.sh" "<link-ou-arquivo>" ["<link2>" ...]
```

O script:
- instala o transcritor (faster-whisper) se faltar;
- baixa a página de incorporação do Instagram (legenda e autor) e o vídeo;
- gera mosaicos de quadros, com 1 quadro a cada 3 segundos e 8 por imagem;
- transcreve o áudio em português.

No fim, ele imprime a pasta de saída de cada vídeo, com estes arquivos: `info.txt` (autor e legenda), `quadros_NN.jpg`, `transcricao.txt` e `video.mp4`.

A primeira transcrição de uma sessão baixa o modelo (cerca de 500 MB) e leva de 1 a 3 minutos. Use timeout de 600000 ms.

## Passo 2: assistir

1. Leia `info.txt` e `transcricao.txt`.
2. Abra **todas** as imagens `quadros_*.jpg` com a ferramenta Read. É assim que você vê o vídeo: repare em telas, nomes de repositório, números e textos na tela.
3. Se aparecer um repositório do GitHub, confira estrelas, licença, data e descrição com:
   `gh api -X GET search/repositories -f q='<nome>' --jq '.items[:3][]|"\(.full_name) ★\(.stargazers_count) \(.license.spdx_id) upd:\(.pushed_at) | \(.description)"'`

## Passo 3: responder

Seja direto, em português e com este formato para cada vídeo:
- **O que o vídeo mostra de fato**: com base nos quadros e na fala, não só na legenda.
- **É verdade? / Dá para fazer?**: veredito claro, apontando exageros e o que o vídeo esconde (custo, requisitos, se é de outro país, licença, risco).
- **Vale para nós?**: separe **projeto pessoal** de **campanha política**. Na campanha, cheque a lei eleitoral: brindes, doações, impulsionamento e prestação de contas.
- Termine com uma tabela-resumo, se houver mais de um vídeo, e um **próximo passo** claro.

Os perfis que pedem "comenta X que eu mando no direct" estão só captando contatos. Sempre dê o link público direto.

## Se der erro

- **`403` / `CONNECT tunnel failed` ao baixar o vídeo:** o servidor do vídeo não está liberado na rede. O script imprime qual host falhou, por exemplo `scontent-xxx.cdninstagram.com`. Chame `get_environment` e depois `update_environment` com `add_allowed_hosts` contendo esse host exato, explicando ao usuário em uma frase. Depois rode de novo.
- **O modelo de transcrição não baixa:** os hosts `huggingface.co`, `us.aws.cdn.hf.co`, `cas-bridge.xethub.hf.co` e `cdn-lfs.huggingface.co` precisam estar liberados. O script já desliga o modo Xet.
- **O Instagram não entrega o vídeo** (post privado ou removido): diga isso e peça ao usuário para enviar o arquivo do vídeo ou prints. O script também aceita um caminho de arquivo local.
- **Sem transcrição possível:** analise mesmo assim pelos quadros e pela legenda, e avise que faltou o áudio.
