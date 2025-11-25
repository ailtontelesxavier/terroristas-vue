# Consulta de Sancionados da ONU (Vue 3)

Aplicação Vue 3 (Composition API + Vite) para consultar a lista consolidada de sancionados da ONU, buscar por nome, paginar resultados e cruzar nomes a partir de um CSV enviado pelo usuário.

## Requisitos

- Node.js 18+
- npm

## Instalação e execução

```bash
npm install
npm run dev
# abra o endereço exibido no terminal
```

## Layout esperado do CSV

- Delimitador: vírgula (`,`) ou ponto e vírgula (`;`).
- Primeira coluna deve conter o nome a ser verificado.
- Cabeçalho é opcional, mas se existir deve ter algo como `nome` ou `name` para ser ignorado na leitura.
- Exemplo (pode ser salvo como `clientes.csv`):

```csv
nome
Joao da Silva
Maria Oliveira
```

ou

```csv
name;id_interno
Ana Souza;123
Carlos Santos;456
```

## Observações sobre o fetch da lista

Durante o desenvolvimento (modo `npm run dev`), o Vite está configurado para fazer proxy do endpoint local `/api/onu` para o XML final hospedado pelo Azure (para evitar problemas de CORS e redirecionamento 302). Em produção, configure um proxy equivalente (backend ou CDN) para o mesmo destino:

```
https://unsolprodfiles.blob.core.windows.net/publiclegacyxmlfiles/EN/consolidatedLegacyByPRN.xml
```

## Funcionalidades

- Atualizar a lista da ONU manualmente.
- Buscar indivíduos por nome/alias com normalização de acentos.
- Paginação dos resultados.
- Upload de CSV e verificação de coincidências com a lista carregada.
