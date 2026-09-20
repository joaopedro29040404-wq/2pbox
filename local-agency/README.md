# 2P Box Local Agency

Ponte local da Agência 2P Box. Não usa API paga de IA.

## Requisitos
- Node.js 20+
- Ollama com um modelo local
- ComfyUI local
- Um checkpoint avançado instalado no ComfyUI

## Executar
Windows PowerShell:
```powershell
$env:OLLAMA_MODEL="llama3.2"
$env:COMFYUI_CHECKPOINT="SEU_MODELO"
node local-agency/agent.mjs
```

Linux/macOS:
```bash
OLLAMA_MODEL=llama3.2 COMFYUI_CHECKPOINT=SEU_MODELO node local-agency/agent.mjs
```

O serviço escuta somente em 127.0.0.1:4317. A Agência 2P Box detecta a conexão automaticamente.

A geração visual é sempre avançada. O limite é 4 Stories e 2 Reels por dia. Os resultados ficam disponíveis na própria área da Agência no navegador.
