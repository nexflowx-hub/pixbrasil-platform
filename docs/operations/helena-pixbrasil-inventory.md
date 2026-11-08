# Helena — inventário PiXBrasil nas VPS

Objetivo: localizar a implantação existente do PiXBrasil e preparar o alojamento de site, Admin e API na VPS AtlasHub.

Ação autorizada neste pedido: inspeção de leitura. Não fazer deploy, reiniciar serviços, puxar código sobre alterações locais, aplicar migrações, alterar DNS ou criar cobranças durante o inventário.

1. Em cada VPS a que já tens acesso autorizado, executar o script ops/inventory-pixbrasil-readonly.sh deste branch com bash.
2. Complementar os resultados nos locais de instalação que conheces; o script tem pesquisa limitada.
3. Confirmar quais domínios/sites estão em Vercel e quais serviços estão na VPS, sem pressupor que o manifesto no GitHub coincide com o runtime.
4. Inspecionar de forma restrita a configuração necessária para identificar o destino de Postgres/Redis e credenciais por referência; no retorno, apenas nome lógico/projeto e estado. Não copiar valores sensíveis.
5. Identificar backup disponível e capacidade de CPU/RAM/disco, conflitos de porta e rede Caddy.
6. Comparar HEAD, branch e alterações locais com o commit main atual. Preservar diferenças da VPS e informar antes de qualquer sincronização.

Retorno esperado:

| Campo | Resultado |
|---|---|
| VPS / host | |
| Caminho do projeto | |
| Branch e SHA | |
| Alterações locais | |
| API: container, imagem, estado e release | |
| Site e Admin: alojamento atual | |
| Postgres e Redis: destino lógico / estado | |
| Edge, portas e domínios | |
| Backup e recuperação | |
| Capacidade disponível | |
| Diferenças GitHub/runtime e próximos passos | |

Não anexar .env, tokens, dumps financeiros ou logs brutos. O pedido está preparado para encaminhamento; este ficheiro não significa que a mensagem foi enviada.
