---
name: software-security-hardening
description: Hardening completo de software e infraestrutura defensiva com validacao de controles, varredura de vulnerabilidades, deteccao de segredos e chaves expostas, e mitigacao de forca bruta e DDoS. Use quando precisar auditar repositorios, APIs, autenticacao, logs de acesso, configuracoes de rede e WAF, pipelines CI/CD, ou priorizar e corrigir riscos de seguranca antes de deploy.
---

# Software Security Hardening

## Objetivo

Executar auditoria defensiva de ponta a ponta para reduzir superficie de ataque e bloquear release insegura.
Produzir evidencias objetivas com severidade, risco e recomendacao de correcao.

## Fluxo Operacional

1. Delimitar escopo e criticidade do sistema.
2. Rodar baseline automatizada para segredos expostos e abuso de acesso.
3. Avaliar controles de autenticacao, autorizacao, sessao e rate limiting.
4. Identificar vulnerabilidades de codigo, dependencias, containers e infraestrutura.
5. Priorizar correcao por risco de negocio e explorabilidade.
6. Revalidar e liberar somente quando os gates de seguranca estiverem verdes.

## Execucao Rapida

Executar a baseline local:

```bash
scripts/run_security_audit.sh . /var/log/nginx/access.log ./security-artifacts
```

Executar somente scanner de segredos:

```bash
python3 scripts/scan_exposed_secrets.py --path . --format text --fail-on-findings
```

Executar somente detector de brute force e DDoS:

```bash
python3 scripts/analyze_access_patterns.py --log-file ./access.log --fail-on-findings
```

Combinar relatorios e aplicar gate:

```bash
python3 scripts/security_gate.py --report ./security-artifacts/secrets-report.json --report ./security-artifacts/access-report.json --max-critical 0 --max-high 0 --max-medium 3
```

## Procedimento Detalhado

### 1) Delimitar Escopo

Mapear ativos: aplicacao web, API, banco, fila, storage, CI/CD, DNS, CDN, WAF e segredos.
Classificar dados por sensibilidade: publico, interno, confidencial, regulado.
Definir SLO de seguranca: tempo maximo para mitigar critico, alto e medio.

### 2) Validar Seguranca Basica do Software

Exigir TLS forte e cabecalhos de seguranca.
Exigir sessao segura com cookie `HttpOnly`, `Secure` e `SameSite`.
Exigir protecao CSRF quando houver sessao baseada em cookie.
Exigir validacao server-side para toda entrada externa.
Exigir politica de erro sem vazamento de stack trace em producao.

Usar [references/hardening-checklist.md](references/hardening-checklist.md) como matriz de verificacao.

### 3) Verificar Vulnerabilidades

Executar SAST no codigo e revisar rotas criticas manualmente.
Executar auditoria de dependencias (npm/pnpm/pip/go/cargo) e atualizar libs exploraveis.
Executar scan de imagem de container e remover pacotes desnecessarios.
Executar checagem de IaC para portas abertas, politicas permissivas e segredos embutidos.

Registrar cada achado com: ativo, vetor de ataque, severidade, impacto, evidencia e plano de correcao.

### 4) Detectar Chaves Expostas

Rodar `scripts/scan_exposed_secrets.py` em todo repositorio e artefatos de build.
Revogar imediatamente credenciais vazadas.
Rotacionar segredos em origem (vault, cloud secret manager, CI vars).
Auditar historico Git e remover segredo do historico quando necessario.

### 5) Mitigar Forca Bruta e DDoS

Rodar `scripts/analyze_access_patterns.py` em logs recentes.
Aplicar rate limiting por IP, token, rota e ASN quando possivel.
Aplicar lockout progressivo com backoff para tentativas de login.
Aplicar MFA em contas administrativas e acessos sensiveis.
Aplicar WAF/CDN com regras de reputacao, geo e challenge.
Aplicar circuit breaker e limite de concorrencia para rotas caras.

Usar [references/attack-protection-playbook.md](references/attack-protection-playbook.md) para resposta tatica.

### 6) Aplicar Gate de Seguranca

Consolidar relatorios no `scripts/security_gate.py`.
Bloquear release quando houver qualquer critico, ou quando limites de alto/medio forem excedidos.
Permitir excecao somente com risco aceito explicitamente e prazo de mitigacao.

## Regras de Prioridade

Priorizar explorabilidade real e impacto de negocio:

1. Critico: execucao remota, bypass de auth, exfiltracao de segredo ativo.
2. Alto: brute force sem controle, DDoS sem mitigacao, dependencia exploravel em superficie externa.
3. Medio: hardening ausente sem exploit imediato conhecido.
4. Baixo: melhoria defensiva sem risco imediato.

Usar [references/remediation-priority.md](references/remediation-priority.md) para padronizar decisao.

## Entregaveis Minimos

Gerar relatorio com:

1. Inventario do escopo auditado.
2. Tabela de achados com severidade e evidencias.
3. Plano de mitigacao com dono e prazo.
4. Resultado do gate final (pass/fail).

## Recursos

- `scripts/scan_exposed_secrets.py`: localizar segredos e chaves potencialmente expostos.
- `scripts/analyze_access_patterns.py`: detectar padroes de brute force e DDoS em logs HTTP.
- `scripts/security_gate.py`: consolidar relatorios e decidir gate de release.
- `scripts/run_security_audit.sh`: executar baseline defensiva em sequencia.
- `references/hardening-checklist.md`: checklist de seguranca por camada.
- `references/attack-protection-playbook.md`: playbook de resposta para brute force e DDoS.
- `references/remediation-priority.md`: matriz de priorizacao e SLA de correcao.
