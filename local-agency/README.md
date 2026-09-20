# Agência 2P Box — processamento no navegador

O motor da agência é executado dentro do navegador, sem Ollama, ComfyUI, Python, Docker ou processo local separado.

A aplicação usa as APIs locais do navegador para composição e renderização e detecta WebGPU quando disponível. O histórico fica no armazenamento local.

Modelos generativos de difusão completos são arquivos muito grandes para serem tratados como código comum do Git. Por isso esta implementação não instala software no PC nem inicia servidor local.
