# VPS e permissões — evidências de 31/10/2026

Escopo: proteção operacional da sala e QA técnico de permissões. A sala continua exclusiva Pro; download público não concede direitos. Não foram alterados planos, pagamentos, arquivos ou sessões de pessoas reais. Nenhuma proteção de CAPTCHA/OTP foi desativada.

## Estado aplicado

| Controle | Evidência |
| --- | --- |
| Firewall de host | UFW ativo, deny incoming/routed; administração restrita à origem cadastrada |
| SSH | Conta lessonara-admin e sudo verificados em sessão independente; root/senha/keyboard-interactive/forwarding/X11 desativados; MaxAuthTries3 |
| Docker | DOCKER-USER permite somente mídia UDP10000; web8000, JVB8080 e Jicofo8888 em loopback; nenhum socket Docker exposto |
| Containers | UID1000; CapEff/CapPrm zero; NoNewPrivs=1; filesystem read-only, limites CPU/RAM e rotação de logs |
| HTTPS da origem | TCP443 permitido somente aos CIDRs IPv4/IPv6 oficiais Cloudflare; domínio público HTTP200; conexão direta443 bloqueada |
| Certificado/mídia | TCP80 permanece para ACME e redirect; UDP10000 IPv4 permanece para mídia; regra UDP10000 IPv6 sem uso removida; UDP443 não escuta |
| Atualizações | unattended-upgrades e timers ativos, origens de segurança habilitadas; sem pacotes pendentes no índice consultado e sem marcador reboot-required; não foi realizada atualização/reinicialização nesta revisão |
| Relógio | NTP sincronizado; host usa Europe/Berlin, evidências deste documento são da data UTC |
| Imagens | Digests conhecidos fixados na configuração; processos já usavam essas imagens; nenhuma atualização Jitsi ou restart de produção |
| Proteção de acesso | fail2ban sshd ativo; arquivos de implantação privados; VPS sem VPN/rota para o homelab |

O teste a partir da rede administrativa alcançou somente TCP22 e80 na lista examinada. Foram bloqueados443 direto,2019,2375,2376,5222,5269,5280,5347,5432,6379,8000,8080,8888 e9099. Não é um pentest de todas as portas/protocolos nem prova de firewall do provedor Contabo; a camada do provedor não foi inspecionada. IPv6 foi conferido na configuração efetiva do host, sem alegar sondagem externa de uma origem IPv6.

Duas unidades herdadas do boot (`cloud-init.service` e `systemd-networkd-wait-online.service`) constavam como failed. A rede está funcional; não foram reexecutadas nem mascaradas para esconder o estado. Diagnóstico de inicialização fica separado de uma alteração de rede em produção. O pacote Caddy segue a distribuição Ubuntu; revisão de versões/advisories upstream permanece na manutenção periódica, sem inferir segurança absoluta por não haver atualização no índice local.

## Backup e recuperação

- Backup local age diário preservado e ampliado para incluir a configuração de segurança nova. Chave de descriptografia continua fora da VPS.
- Execuções naturais do workflow `Private daily backup` confirmadas com evento schedule e sucesso; exemplos: [41201406887](https://github.com/mosaiclabsco/lessonara/actions/runs/41201406887) e [41224261252](https://github.com/mosaiclabsco/lessonara/actions/runs/41224261252). O cron GitHub pode sofrer atraso; não prometer execução no minuto exato.
- Cópia age descriptografada no Mac em diretório privado descartável; arquivos essenciais, plugins, SHA256 do Compose oficial e `docker compose config --quiet` conferidos; plaintext removido.
- Stack restaurada e iniciada isoladamente na VPS em quatro containers, rede interna, sem portas publicadas ou volumes da produção e com credenciais sintéticas. HTTP e saúde do bridge passaram. Subida/saúde:18 segundos; transferência/preparo/validação/limpeza:36,4 segundos. Esses tempos não são RTO do produto nem incluem provisionar outra VPS.
- Primeira tentativa usou checagem por portas em loopback de uma rede interna e não concluiu; foi removida. O procedimento validado faz a checagem dentro dos containers, sem publicar portas.
- Não há novas credenciais R2 na VPS nem endpoint público de exportação. A aprovação automática bloqueou esse endpoint até consentimento específico sobre o arquivo criptografado e o destino R2; proposta e código de preparação permanecem fora da implantação.
- O canal Telegram existente no monitoramento respondeu `chat not found` ao validar o destino, sem envio de teste. Alertas entregues/recebidos não foram comprovados; aguarda destinatário autorizado. Nenhuma configuração do homelab foi alterada.

## Matriz técnica de acesso

89 testes focados de aplicação/SQL passaram em14 arquivos, com um worker. Cobrem direitos por plano, RLS, filas após downgrade/suspensão, cotas, sala, material, cron, sessões e códigos de aluno, exportação e autorização Google. Quatro testes Python verificam a validação dos CIDRs antes de mutações do firewall.

42 verificações em produção passaram com três professores e alunos fictícios Essencial/Plus/Pro:

- Leitura própria e negação de leitura/escrita entre tenants no RLS; página de aluno de outra conta negada.
- Alteração do próprio plano pelo cliente recusada.
- Exportação direta403 no Essencial e200 no Plus/Pro; Google403 no Essencial e redirecionamento autorizado no Plus/Pro, sem concluir OAuth.
- Requisições diretas anônimas exigem login e acesso à sala de outra conta retorna403.
- Banco recusa reserva acima de20/50/50MB e aceita o limite exato. Os arquivos grandes não foram enviados.
- Três pequenos arquivos de texto foram criados exclusivamente para QA. Download próprio funcionou por URL assinada; download cruzado no aplicativo e diretamente no Storage foi negado.
- Nenhum email enfileirado ou pagamento criado. Os três arquivos e as contas fictícias foram removidos; contagem final de professores de teste foi zero.

Não confundir a sessão técnica de QA, emitida para contas sintéticas pela administração Auth, com recebimento real de OTP por email. OTP real e conferência de iPhone foram adiados explicitamente pelo usuário; câmera/áudio com duas pessoas continuam no piloto, não executados nesta rodada. Esses testes também não substituem exercício de recuperação completo do produto em infraestrutura substituta.

## Fontes oficiais consultadas

- [Docker: publicação de portas e firewall](https://docs.docker.com/engine/network/packet-filtering-firewalls/) e [DOCKER-USER](https://docs.docker.com/engine/network/firewall-iptables/).
- [Ubuntu: OpenSSH](https://ubuntu.com/server/docs/how-to/security/openssh-server/) e [atualizações automáticas](https://ubuntu.com/server/docs/how-to/software/automatic-updates/).
- [Cloudflare: proteger a origem](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/) e [API de CIDRs](https://developers.cloudflare.com/api/resources/ips/methods/list/).
- [Jitsi: requisitos de rede Docker](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/).
