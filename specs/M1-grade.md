# Spec — M1: Grade de Atividades

## 1. Objetivo

Permitir que a organização da Semana Acadêmica planeje, cadastre, gerencie e publique a programação das atividades (palestras e minicursos), alocando salas e horários sem conflitos físicos e dentro das restrições do evento, garantindo que participantes e organizadores consultem a grade detalhada e atualizada em tempo real conforme o relógio do evento.

## 2. Fora de escopo

1. **Gestão de Salas:** Cadastro, edição ou exclusão de salas via API. As salas são dados fixos iniciais e apenas consultadas via `GET /salas` (P-13).
2. **Conflito de Agenda de Ministrantes:** Validação de conflito de horário para palestrantes ou organizadores, uma vez que a atividade não armazena ID de ministrante (P-05).
3. **Exclusão Física:** Não existe endpoint ou operação `DELETE` para atividades; o encerramento do ciclo de vida é feito exclusivamente pelo cancelamento lógico (`POST /atividades/:id/cancelamento`) (P-08).
4. **Tratamento de Inscrições no Cancelamento:** O cancelamento em cascata ou notificação de participantes com inscrições ativas quando uma atividade é cancelada pertence ao escopo do módulo M2 (P-08).
5. **Teto de Carga Horária por Tipo para Certificados:** Não há limite máximo de carga horária para atividades no M1; limites de horas para aproveitamento e certificação pertencem ao módulo M4 (P-06).
6. **Agrupamento de Dados na API:** A API não agrupa atividades por dia na resposta de `GET /atividades`; ela fornece uma lista ordenada plana, sendo o agrupamento visual por dia responsabilidade da interface (P-10).
7. **Cadastro e Gerenciamento de Usuários:** A criação de usuários e emissão de credenciais não faz parte da API; a identificação baseia-se estritamente nos usuários pré-cadastrados via cabeçalho `X-Usuario` (P-09).

## 3. Modelo

### Atividade
- `id` (string): Identificador único gerado pelo servidor no padrão `atv_` + 8 hexadecimais minúsculos (ex.: `atv_1a2b3c4d`). Gerado.
- `titulo` (string): Título descritivo da atividade. Informado pelo cliente (editável via `PATCH`).
- `tipo` (string): Tipo da atividade, obrigatoriamente `"palestra"` ou `"minicurso"`. Informado pelo cliente (fixo após criação).
- `salaId` (string): Identificador da sala vinculada. Informado pelo cliente (fixo após criação).
- `vagas` (inteiro): Número de vagas ofertadas. Informado pelo cliente (editável via `PATCH`).
- `encontros` (array de `Encontro`): Lista cronológica dos encontros que compõem a atividade. Informado pelo cliente e enriquecido com IDs pelo servidor (fixo após criação).
- `cargaHorariaMinutos` (inteiro): Duração total da atividade em minutos. Calculado (nunca armazenado nem informado pelo cliente).
- `situacao` (string): Estado atual da atividade (`"prevista"`, `"em_andamento"`, `"encerrada"`, `"cancelada"`). Calculado dinamicamente com base no relógio do sistema/modo de teste.
- `ocupadas` (inteiro): Total de inscrições que ocupam vaga (`confirmada` + `convocada`). Calculado.
- `vagasRestantes` (inteiro): Vagas remanescentes (`vagas - ocupadas`). Calculado.
- `emEspera` (inteiro): Quantidade de inscritos na fila de espera (`em_espera`). Calculado.

### Encontro
- `id` (string): Identificador único do encontro gerado pelo servidor no padrão `enc_` + 8 hexadecimais minúsculos (ex.: `enc_5e6f7a8b`). Gerado.
- `inicio` (string): Data e hora de início no formato ISO 8601 com fuso horário (ex.: `2026-10-19T19:00:00-03:00`). Informado pelo cliente.
- `fim` (string): Data e hora de término no formato ISO 8601 com fuso horário (ex.: `2026-10-19T22:00:00-03:00`). Informado pelo cliente.

### Sala (Dado Inicial Fixo)
- `id` (string): Identificador da sala (`"auditorio"`, `"sala-101"`, `"sala-102"`, `"lab-3"`). Fixo.
- `nome` (string): Nome da sala. Fixo.
- `capacidade` (inteiro): Capacidade máxima de ocupantes da sala. Fixo.

## 4. Endpoints

| Método | Caminho | Papel Mínimo | Entrada | Sucesso |
|---|---|---|---|---|
| `GET` | `/salas` | Qualquer usuário (`participante` ou `organizacao`) | Nenhum | `200 OK` — `[Sala]` |
| `GET` | `/atividades` | Qualquer usuário (`participante` ou `organizacao`) | Query params: `?dia=AAAA-MM-DD`, `?tipo=palestra\|minicurso` | `200 OK` — `[Atividade]` |
| `GET` | `/atividades/:id` | Qualquer usuário (`participante` ou `organizacao`) | Nenhum | `200 OK` — `Atividade` |
| `POST` | `/atividades` | `organizacao` | JSON: `titulo`, `tipo`, `salaId`, `vagas`, `encontros` | `201 Created` — `Atividade` |
| `PATCH` | `/atividades/:id` | `organizacao` | JSON: subconjunto de `titulo` e/ou `vagas` | `200 OK` — `Atividade` |
| `POST` | `/atividades/:id/cancelamento` | `organizacao` | Nenhum | `200 OK` — `Atividade` |

## 5. Regras

- **R1 — Identificação obrigatória do usuário:** Toda requisição nas rotas do módulo M1 deve conter o cabeçalho `X-Usuario` com o ID de um usuário pré-cadastrado no sistema. Se o cabeçalho estiver ausente ou o ID não constar entre os usuários cadastrados de fábrica, a API recusa a requisição com status HTTP `401` e erro `USUARIO_DESCONHECIDO`.
  - *Origem:* Pergunta P-09 | `contrato-api.md`, seção 1.

- **R2 — Permissão restrita à organização:** As operações de criação (`POST /atividades`), alteração (`PATCH /atividades/:id`) e cancelamento (`POST /atividades/:id/cancelamento`) são exclusivas de usuários com papel `organizacao` (`org-ana`, `org-bruno`). Caso um usuário com papel `participante` tente executá-las, a API recusa com status HTTP `403` e erro `SOMENTE_ORGANIZACAO`. As rotas de leitura (`GET`) são públicas para todos os usuários cadastrados.
  - *Origem:* Pergunta P-09 | RN-101; `contrato-api.md`, seção 5.

- **R3 — Precedência na ordem de validação:** O processamento das requisições deve obedecer estritamente à seguinte ordem de validação antes de executar regras de negócio:
  1. Identificação do usuário (`401 USUARIO_DESCONHECIDO`);
  2. Perfil de acesso (`403 SOMENTE_ORGANIZACAO`);
  3. Existência do recurso da URL (`404 NAO_ENCONTRADO`);
  4. Formato e integridade do payload (`422 DADOS_INVALIDOS`);
  5. Regras de negócio do recurso.
  - *Origem:* Perguntas P-12, P-14 | `contrato-api.md`, seção 1.

- **R4 — Existência da atividade na URL:** Nas rotas parametrizadas por ID (`GET /atividades/:id`, `PATCH /atividades/:id` e `POST /atividades/:id/cancelamento`), se o `id` informado não corresponder a uma atividade previamente cadastrada, a API recusa a operação com status HTTP `404` e erro `NAO_ENCONTRADO`.
  - *Origem:* Pergunta P-14 | `contrato-api.md`, seção 1 e seção 6.

- **R5 — Validação sintática do payload de criação:** No `POST /atividades`, a API recusa a requisição com status HTTP `422` e erro `DADOS_INVALIDOS` se o corpo não for JSON válido, se faltar algum dos campos obrigatórios (`titulo`, `tipo`, `salaId`, `vagas`, `encontros`), se `titulo` for vazio ou não textual, se `vagas` for menor que 1 ou não for inteiro, se `tipo` for diferente de `"palestra"` ou `"minicurso"`, se `salaId` não corresponder a nenhuma das salas cadastradas de fábrica, ou se `encontros` for vazio ou contiver datas que não sejam ISO 8601 válidas com fuso horário.
  - *Origem:* Perguntas P-12, P-13, P-15 | `contrato-api.md`, seção 1; formato do título e erro de `salaId` inexistente: Decisão do grupo.

- **R6 — Quantidade de encontros por tipo:** No `POST /atividades`, a quantidade de encontros fornecida no array `encontros` deve satisfazer o tipo de atividade:
  - Atividades do tipo `palestra`: devem ter exatamente 1 encontro;
  - Atividades do tipo `minicurso`: devem ter de 2 a 5 encontros.
  Qualquer quantidade fora desses intervalos resulta em recusa com status HTTP `422` e erro `QUANTIDADE_DE_ENCONTROS`.
  - *Origem:* Pergunta P-01 | RN-102, RN-103.

- **R7 — Validade e limites dos encontros:** No `POST /atividades`, cada encontro do array `encontros` deve atender cumulativamente a:
  a) Duração mínima de 1 hora (60 minutos) e máxima de 4 horas (240 minutos);
  b) Início e término ocorrendo dentro do mesmo dia civil no calendário de Brasília (UTC-03:00), sendo proibido cruzar a meia-noite;
  c) Realização estritamente dentro do período oficial do evento, de 19/10/2026 a 23/10/2026 (fuso de Brasília);
  d) Ausência de sobreposição de horários com outro encontro da mesma atividade.
  A violação de qualquer dessas condições resulta em status HTTP `422` e erro `ENCONTRO_INVALIDO`.
  - *Origem:* Pergunta P-02 | RN-104, RN-105, RN-106.

- **R8 — Limite de vagas pela capacidade da sala:** Tanto na criação (`POST /atividades`) quanto na alteração de vagas (`PATCH /atividades/:id`), o campo `vagas` deve ser maior ou igual a 1 e não pode ultrapassar a capacidade máxima da sala vinculada (`vagas <= sala.capacidade`). Se `vagas > sala.capacidade`, a API recusa com status HTTP `422` e erro `VAGAS_ACIMA_DA_CAPACIDADE`. Não há exceção nem tolerância.
  - *Origem:* Perguntas P-03, P-06 | RN-107.

- **R9 — Conflito de ocupação de sala e intervalo mínimo:** No `POST /atividades`, a alocação de sala verifica todos os encontros de atividades ativas existentes na mesma sala. A exigência de intervalo mínimo de 15 minutos entre encontros (tempo de limpeza e troca de turma) é estritamente simétrica:
  - *Sentido 1 (novo encontro após existente):* Se o novo encontro inicia após o término de um encontro existente na mesma sala, ele não pode começar cedo demais (`novo.inicio < existente.fim + 15 minutos` para `novo.inicio >= existente.fim`). Exemplo: encontro existente termina às 10:00 e o novo começa às 10:10 (intervalo de 10 min < 15 min) → recusa com `CONFLITO_DE_SALA`.
  - *Sentido 2 (novo encontro antes de existente):* Se o novo encontro termina antes do início de um encontro existente já marcado na mesma sala, ele não pode terminar cedo demais / perto demais do início do próximo (`novo.fim + 15 minutos > existente.inicio` para `novo.fim <= existente.inicio`). Exemplo: novo encontro termina às 13:50 e o existente começa às 14:00 (intervalo de 10 min < 15 min) → recusa com `CONFLITO_DE_SALA`.
  - *Sobreposição direta:* Qualquer sobreposição de horários entre encontros na mesma sala é estritamente proibida.
  Encontros de atividades com situação `cancelada` são desconsiderados nesta verificação. Havendo conflito (sobreposição ou desrespeito ao intervalo mínimo de 15 minutos em qualquer um dos sentidos), a API recusa com status HTTP `409` e erro `CONFLITO_DE_SALA`.
  - *Origem:* Perguntas P-04, P-08 | RN-108.

- **R10 — Identificadores e cálculo de carga horária:** Ao criar a atividade com sucesso (`POST /atividades` → `201 Created`), o servidor gera o `id` da atividade (`atv_` + 8 hexadecimais), o `id` de cada encontro (`enc_` + 8 hexadecimais), ordena os encontros cronologicamente por `inicio`, e calcula a `cargaHorariaMinutos` como a soma exata das durações de todos os encontros em minutos. Se o cliente enviar o campo `cargaHorariaMinutos`, este valor é ignorado.
  - *Origem:* Perguntas P-06, P-12 | RN-109; `contrato-api.md`, seção 1.

- **R11 — Imutabilidade de campos estruturais na edição:** No `PATCH /atividades/:id`, apenas os campos `titulo` e `vagas` podem ser modificados. Qualquer tentativa de enviar alterações para `salaId`, `tipo`, `encontros` ou campos calculados/gerados resulta em recusa imediata com status HTTP `422` e erro `CAMPO_NAO_EDITAVEL`.
  - *Origem:* Perguntas P-07, P-15 | RN-110; Decisão do grupo.

- **R12 — Bloqueio de redução de vagas abaixo dos inscritos:** No `PATCH /atividades/:id`, o novo valor de `vagas` não pode ser inferior ao número de inscrições que já ocupam vaga (`ocupadas = confirmadas + convocadas`). Se `vagas < ocupadas`, a API recusa a alteração com status HTTP `409` e erro `VAGAS_ABAIXO_DOS_INSCRITOS`.
  - *Origem:* Perguntas P-07, P-11 | RN-111; Decisão do grupo, a confirmar com o M2.

- **R13 — Convocação automática ao expandir vagas:** No `PATCH /atividades/:id`, ao aumentar o número de `vagas`, se houver inscrições em lista de espera (`status: "em_espera"`), o primeiro participante da lista de espera é automaticamente convocado para cada nova vaga aberta.
  - *Origem:* Pergunta P-07 | RN-111.

- **R14 — Imutabilidade de atividade cancelada:** Uma atividade com situação `cancelada` não aceita alterações nem novo cancelamento. Qualquer requisição `PATCH /atividades/:id` ou `POST /atividades/:id/cancelamento` direcionada a uma atividade cancelada é recusada com status HTTP `422` e erro `ATIVIDADE_CANCELADA`.
  - *Origem:* Perguntas P-07, P-08 | RN-113.

- **R15 — Cancelamento antes do início e bloqueio posterior:** Uma atividade só pode ser cancelada via `POST /atividades/:id/cancelamento` antes do instante de início do seu primeiro encontro (`inicio`). Se o relógio do sistema/modo de teste for igual ou posterior ao horário de início do primeiro encontro, a API recusa com status HTTP `422` e erro `ATIVIDADE_JA_INICIADA`. Quando aceito antes do início, a atividade transita definitivamente para `cancelada` (`200 OK`) e seus encontros deixam de ocupar a sala para checagem de conflitos.
  - *Origem:* Pergunta P-08 | RN-112, RN-108.

- **R16 — Listagem e ordenação padrão de atividades:** A rota `GET /atividades` retorna a lista plana de todas as atividades (incluindo as canceladas), ordenada prioritariamente pelo horário de início do 1º encontro de forma ascendente. Em caso de empate no horário de início, o desempate é feito por ordem alfabética ascendente do campo `titulo`.
  - *Origem:* Pergunta P-10 | RN-115, RN-116.

- **R17 — Filtros por dia e tipo na listagem:** Na rota `GET /atividades`:
  - O filtro `?dia=AAAA-MM-DD` retorna apenas as atividades que possuem pelo menos um encontro ocorrendo naquele dia civil, considerado estritamente no fuso horário oficial de Brasília (UTC-03:00);
  - O filtro `?tipo=palestra|minicurso` retorna apenas as atividades do tipo correspondente;
  - Ambos os filtros podem ser combinados simultaneamente.
  - *Origem:* Pergunta P-10 | RN-115; `contrato-api.md`, seção 5.

- **R18 — Cálculo dinâmico da situação da atividade:** O campo `situacao` é derivado dinamicamente a partir do relógio do sistema (ou do relógio controlado em modo de teste):
  - `cancelada`: prevalece sobre qualquer horário se a atividade tiver sido cancelada pela organização;
  - `prevista`: quando o relógio for estritamente anterior ao início do 1º encontro;
  - `em_andamento`: quando o relógio for maior ou igual ao início do 1º encontro e menor ou igual ao fim do último encontro;
  - `encerrada`: quando o relógio for estritamente posterior ao fim do último encontro.
  - *Origem:* Pergunta P-11 | RN-114.

- **R19 — Cálculo derivado de métricas de ocupação e vagas:** Em todas as respostas contendo a entidade `Atividade`, os seguintes campos numéricos são calculados:
  - `ocupadas`: total de inscrições com status `confirmada` ou `convocada`;
  - `vagasRestantes`: vagas - ocupadas, nunca negativo (decisão do grupo, dado que R12 já impede vagas menor que ocupadas);
  - `emEspera`: total de inscrições com status `em_espera`.
  Ao criar a atividade, `ocupadas: 0`, `vagasRestantes: vagas` e `emEspera: 0`.
  - *Origem:* Pergunta P-11 | `contrato-api.md`, seção 5; Decisão do grupo, a confirmar com o M2.

- **R20 — Consulta de salas fixas:** A rota `GET /salas` retorna a lista com status HTTP `200` contendo as 4 salas fixas iniciais (`auditorio` com 200, `sala-101` com 40, `sala-102` com 40, e `lab-3` com 20), com seus respectivos IDs, nomes e capacidades. Não há rotas para modificar ou criar salas.
  - *Origem:* Pergunta P-13 | `contrato-api.md`, seção 4 e seção 5.

## 6. Critérios de aceite

1. **(R1)** `GET /salas` sem cabeçalho `X-Usuario` → `401 Unauthorized`, `{"erro": "USUARIO_DESCONHECIDO", "mensagem": "..."}`.
2. **(R1)** `POST /atividades` com `X-Usuario: usr_invalido` → `401 Unauthorized`, `{"erro": "USUARIO_DESCONHECIDO", "mensagem": "..."}`.
3. **(R2)** `POST /atividades` autenticado com `X-Usuario: p-carla` (participante) → `403 Forbidden`, `{"erro": "SOMENTE_ORGANIZACAO", "mensagem": "..."}`.
4. **(R2)** `PATCH /atividades/atv_1a2b3c4d` com `X-Usuario: p-diego` (participante) → `403 Forbidden`, `{"erro": "SOMENTE_ORGANIZACAO", "mensagem": "..."}`.
5. **(R2)** `POST /atividades/atv_1a2b3c4d/cancelamento` com `X-Usuario: p-carla` (participante) → `403 Forbidden`, `{"erro": "SOMENTE_ORGANIZACAO", "mensagem": "..."}`.
6. **(R1, R2, R20)** Rotas de leitura (`GET /atividades` e `GET /salas`) autenticadas com `X-Usuario: p-carla` (participante) → `200 OK` (não erro), retornando os dados (em `/salas`, array com as 4 salas cadastradas: `auditorio`, `sala-101`, `sala-102`, `lab-3`), confirmando explicitamente que um `X-Usuario` de um participante em rota de leitura retorna `200 OK` (não erro), deixando claro que "não identificado" (`401 USUARIO_DESCONHECIDO`) e "sem permissão para escrever" (`403 SOMENTE_ORGANIZACAO`) são coisas diferentes de "pode ler".
7. **(R3, R4)** `PATCH /atividades/atv_inexistente` com JSON vazio por `org-ana` → `404 Not Found`, `{"erro": "NAO_ENCONTRADO", "mensagem": "..."}` (existência avaliada antes do corpo).
8. **(R4)** `GET /atividades/atv_inexistente` com `X-Usuario: p-carla` → `404 Not Found`, `{"erro": "NAO_ENCONTRADO", "mensagem": "..."}`.
9. **(R5)** `POST /atividades` por `org-ana` com corpo mal formatado (não JSON ou campos obrigatórios ausentes) → `422 Unprocessable Entity`, `{"erro": "DADOS_INVALIDOS", "mensagem": "..."}`.
10. **(R5)** `POST /atividades` por `org-ana` com `tipo: "seminario"` ou `titulo: ""` → `422 Unprocessable Entity`, `{"erro": "DADOS_INVALIDOS", "mensagem": "..."}`.
11. **(R5)** `POST /atividades` por `org-ana` com `salaId: "sala-inexistente"` → `422 Unprocessable Entity`, `{"erro": "DADOS_INVALIDOS", "mensagem": "..."}`.
12. **(R5)** `POST /atividades` por `org-ana` com data/hora de encontro sem especificação de fuso horário → `422 Unprocessable Entity`, `{"erro": "DADOS_INVALIDOS", "mensagem": "..."}`.
13. **(R6)** `POST /atividades` por `org-ana` com `tipo: "palestra"` e 2 encontros no array → `422 Unprocessable Entity`, `{"erro": "QUANTIDADE_DE_ENCONTROS", "mensagem": "..."}`.
14. **(R6)** `POST /atividades` por `org-ana` com `tipo: "minicurso"` e 1 encontro (ou 6 encontros) → `422 Unprocessable Entity`, `{"erro": "QUANTIDADE_DE_ENCONTROS", "mensagem": "..."}`.
15. **(R7)** `POST /atividades` com encontro de duração inferior a 60 min (ex.: 50 min) ou superior a 240 min (ex.: 250 min) → `422 Unprocessable Entity`, `{"erro": "ENCONTRO_INVALIDO", "mensagem": "..."}`.
16. **(R7)** `POST /atividades` com encontro iniciando às 23:00 e terminando às 00:30 (cruzando a meia-noite em Brasília) → `422 Unprocessable Entity`, `{"erro": "ENCONTRO_INVALIDO", "mensagem": "..."}`.
17. **(R7)** `POST /atividades` com encontro agendado para 18/10/2026 ou 24/10/2026 (fora do período de 19 a 23/10/2026) → `422 Unprocessable Entity`, `{"erro": "ENCONTRO_INVALIDO", "mensagem": "..."}`.
18. **(R7)** `POST /atividades` com dois encontros da mesma atividade possuindo horários sobrepostos → `422 Unprocessable Entity`, `{"erro": "ENCONTRO_INVALIDO", "mensagem": "..."}`.
19. **(R8)** `POST /atividades` para `salaId: "lab-3"` (capacidade 20) com `vagas: 21` → `422 Unprocessable Entity`, `{"erro": "VAGAS_ACIMA_DA_CAPACIDADE", "mensagem": "..."}`.
20. **(R8)** `PATCH /atividades/:id` alterando `vagas` para 45 em atividade na `sala-101` (capacidade 40) → `422 Unprocessable Entity`, `{"erro": "VAGAS_ACIMA_DA_CAPACIDADE", "mensagem": "..."}`.
21. **(R9)** `POST /atividades` com conflito de sala recusando simetricamente o desrespeito ao intervalo mínimo de 15 minutos na mesma sala: (a) quando o novo encontro começa cedo demais após um existente (ex.: existente termina às 10:00 e novo começa às 10:10, intervalo de 10 min < 15 min) → `409 Conflict`, `{"erro": "CONFLITO_DE_SALA", "mensagem": "..."}`; (b) quando o novo encontro termina cedo demais antes de um existente já marcado para começar depois (ex.: novo termina às 13:50 e existente começa às 14:00, intervalo de 10 min < 15 min) → `409 Conflict`, `{"erro": "CONFLITO_DE_SALA", "mensagem": "..."}`.
22. **(R9)** `POST /atividades` na mesma sala respeitando a fronteira simétrica de 15 minutos de intervalo: aceita novo encontro iniciando às 10:15 após existente que terminou às 10:00 (intervalo exato de 15 min), bem como aceita novo encontro terminando às 13:45 antes de existente que inicia às 14:00 (intervalo exato de 15 min) → `201 Created` (aceito sem conflito).
23. **(R9)** `POST /atividades` com encontro em horário sobreposto ou com intervalo inferior a 15 minutos em relação a encontro de atividade que se encontra com `situacao: "cancelada"` na mesma sala → `201 Created` (aceito, atividade cancelada não bloqueia sala).
24. **(R10)** `POST /atividades` válido para minicurso com 2 encontros de 3h (180 min cada) enviando `"cargaHorariaMinutos": 999` → `201 Created`, com ID `atv_...`, encontros contendo IDs `enc_...`, ordenados por início, e campo `cargaHorariaMinutos: 360`.
25. **(R11)** `PATCH /atividades/:id` por `org-ana` enviando campo `salaId: "auditorio"`, `tipo: "palestra"` ou `encontros: [...]` → `422 Unprocessable Entity`, `{"erro": "CAMPO_NAO_EDITAVEL", "mensagem": "..."}`.
26. **(R11)** `PATCH /atividades/:id` por `org-ana` alterando apenas `titulo` para `"Novo Título"` → `200 OK`, com `titulo` atualizado e demais campos preservados.
27. **(R12)** `PATCH /atividades/:id` tentando alterar `vagas` para 10 em atividade que possui 12 inscrições ocupadas (`confirmadas` + `convocadas`) → `409 Conflict`, `{"erro": "VAGAS_ABAIXO_DOS_INSCRITOS", "mensagem": "..."}`.
28. **(R13)** `PATCH /atividades/:id` aumentando `vagas` de 20 para 22 com 2 inscrições com `status: "em_espera"` → `200 OK`, com a convocação da primeira inscrição em espera disparada.
29. **(R14)** `PATCH /atividades/:id` sobre atividade com `situacao: "cancelada"` → `422 Unprocessable Entity`, `{"erro": "ATIVIDADE_CANCELADA", "mensagem": "..."}`.
30. **(R14)** `POST /atividades/:id/cancelamento` sobre atividade que já está com `situacao: "cancelada"` → `422 Unprocessable Entity`, `{"erro": "ATIVIDADE_CANCELADA", "mensagem": "..."}`.
31. **(R15)** `POST /atividades/:id/cancelamento` com o relógio do modo de teste posicionado no instante exato do início do 1º encontro (ou após) → `422 Unprocessable Entity`, `{"erro": "ATIVIDADE_JA_INICIADA", "mensagem": "..."}`.
32. **(R15)** `POST /atividades/:id/cancelamento` com o relógio antes do início do 1º encontro → `200 OK`, retornando a atividade com `situacao: "cancelada"`.
33. **(R16)** `GET /atividades` retorna array ordenado cronologicamente pelo início do 1º encontro de cada atividade e, havendo empate de horário, por ordem alfabética de `titulo`.
34. **(R17)** `GET /atividades?dia=2026-10-20` retorna apenas atividades com encontros ocorrendo no dia 20/10/2026 no fuso horário de Brasília (UTC-03:00).
35. **(R17)** `GET /atividades?dia=2026-10-20&tipo=minicurso` retorna apenas minicursos com encontros no dia 20/10/2026.
36. **(R18)** `GET /atividades/:id` com relógio do modo de teste antes do início do 1º encontro → retorna `situacao: "prevista"`.
37. **(R18)** `GET /atividades/:id` com relógio entre o início do 1º encontro e o término do último encontro → retorna `situacao: "em_andamento"`.
38. **(R18)** `GET /atividades/:id` com relógio após o término do último encontro → retorna `situacao: "encerrada"`.
39. **(R18)** `GET /atividades/:id` de atividade cancelada, independentemente do relógio → retorna `situacao: "cancelada"`.
40. **(R19)** `GET /atividades/:id` de atividade recém-criada → retorna `ocupadas: 0`, `vagasRestantes: vagas` e `emEspera: 0`.

## 7. Como isto será verificado

A verificação do módulo M1 será realizada através da costura mais externa da API (camada HTTP) utilizando a suíte de testes com `node --test` da própria plataforma Node.js:
- **Requisições HTTP Reais:** O executor de testes disparará chamadas HTTP contra a instância do servidor Express (`api/`) instanciada em porta de teste.
- **Ambiente Determinístico:** Os testes rodarão sob `MODO_TESTE=1`. A cada bateria de testes, a rota `POST /_teste/reset` restaurará o banco SQLite para os dados iniciais fixos e relógio em `2026-10-13T09:00:00-03:00`.
- **Manipulação Temporal:** As regras que dependem da linha do tempo do evento (R7, R15 e R18) serão comprovadas manipulando o relógio via `PUT /_teste/relogio` antes de consultar os endpoints, sem nunca utilizar o relógio real do sistema operacional.
- **Interface Web:** A aplicação React (`app/`) será verificada via testes de componentes com Vitest, simulando as respostas da API através de interceptação com MSW (Mock Service Worker).

## 8. Fatias de entrega

### Fatia 1 — Infraestrutura básica e consulta de salas
- **Escopo:** Configuração do servidor Express, middleware de autenticação via cabeçalho `X-Usuario` e endpoint de consulta das salas fixas.
- **Regras cobertas:**
  - R1 (Autenticação obrigatória nas rotas de leitura)
  - R20 (Consulta de salas fixas)

### Fatia 2 — Criação de atividades e integridade de grade
- **Escopo:** Endpoint `POST /atividades`, autorização de organização, validação do payload, validação temporal de encontros, limites de vagas, checagem de conflitos de sala com intervalo de 15 minutos e geração de identificadores/carga horária.
- **Regras cobertas:**
  - R1 (Autenticação obrigatória no POST)
  - R2 (Permissão restrita à organização no POST)
  - R3 (Precedência na ordem de validação)
  - R5 (Validação sintática do payload de criação)
  - R6 (Quantidade de encontros por tipo)
  - R7 (Validade e limites dos encontros)
  - R8 (Limite de vagas pela capacidade da sala na criação)
  - R9 (Conflito de ocupação de sala e intervalo mínimo)
  - R10 (Identificadores e cálculo de carga horária)

### Fatia 3 — Consulta, filtros e dinâmica temporal da programação
- **Escopo:** Endpoints `GET /atividades` e `GET /atividades/:id`, ordenação da grade, filtros por data e tipo em horário de Brasília, cálculo derivado de situação pelo relógio e métricas de vagas.
- **Regras cobertas:**
  - R1 (Autenticação obrigatória nos GETs de atividade)
  - R4 (Existência da atividade na URL para GET)
  - R16 (Listagem e ordenação padrão de atividades)
  - R17 (Filtros por dia e tipo na listagem)
  - R18 (Cálculo dinâmico da situação da atividade)
  - R19 (Cálculo derivado de métricas de ocupação e vagas)

### Fatia 4 — Gestão, alteração e cancelamento de atividades
- **Escopo:** Endpoints `PATCH /atividades/:id` e `POST /atividades/:id/cancelamento`, restrições de edição de campos, bloqueio de redução de vagas abaixo de ocupadas, convocação de lista de espera, cancelamento pré-evento e bloqueio de alterações em atividades canceladas.
- **Regras cobertas:**
  - R1 (Autenticação obrigatória no PATCH e cancelamento)
  - R2 (Permissão restrita à organização no PATCH e cancelamento)
  - R4 (Existência da atividade na URL para PATCH e cancelamento)
  - R8 (Limite de vagas pela capacidade da sala na alteração)
  - R11 (Imutabilidade de campos estruturais na edição)
  - R12 (Bloqueio de redução de vagas abaixo dos inscritos)
  - R13 (Convocação automática ao expandir vagas)
  - R14 (Imutabilidade de atividade cancelada)
  - R15 (Cancelamento antes do início e bloqueio posterior)
