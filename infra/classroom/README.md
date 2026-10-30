# Infraestrutura da sala

Jitsi exclusivo da sala Pro do Lessonara. Não hospeda o portal, banco ou dados dos alunos. A autorização permanece no backend: professor proprietário e aluno vinculado recebem JWT limitado à ocorrência; o Prosody rejeita tokens inválidos e preserva professor owner/aluno member. Não aceitar usuários anônimos, convidados ou auto-owner.

## Acesso

Origem VPS: `13.140.235.111`; SSH com `~/.ssh/id_ed25519_lessonara_contabo`, usuário root por chave. A chave de trabalho e a do homelab não são usadas na VPS.

## Versão e arquivos

A implantação de 30/10/2026 mantém Jitsi stable-11248 e as personalizações já existentes. `images.lock` registra os digests efetivamente validados. O Compose base é oficial, sem modificações:

```sh
curl -fsSL https://raw.githubusercontent.com/jitsi/docker-jitsi-meet/stable-11248/docker-compose.yml -o docker-compose.yml
printf '%s  %s\n' bc14c87a739a3884bbb0c4be2e6ef038b9d8971f498282fdb2d4378755d339f6 docker-compose.yml | sha256sum -c -
```

Executar Compose em `/opt/lessonara-classroom`, junto de `compose.override.yml` e da `.env` protegida. O exemplo não tem segredos e não é uma configuração pronta para produção. Restaurar as personalizações de `config/web` e plugins do arquivo criptografado; não commitar o conteúdo dos volumes ou `.env`.

## Rede e proteção

- VPS independente, sem túnel/VPN/rota para o homelab.
- SSH por chave exclusiva; autenticação por senha desativada. UFW permite SSH apenas do IP administrativo observado durante a instalação. Se esse IP mudar, ajustar a regra pelo console da Contabo usando a credencial pessoal do operador.
- Caddy recebe TCP80/443 e encaminha a interface web para 127.0.0.1:8000. O registro `meet.mosaic-labs.co` continua proxied pela Cloudflare. Emissão automática Let's Encrypt por HTTP-01; TLS-ALPN desativado porque o proxy da Cloudflare termina essa conexão.
- Única publicação Docker externa: UDP10000 para o JVB; endpoints administrativos em loopback. Não confiar somente em UFW para portas publicadas pelo Docker: `docker-ingress.sh` limita tráfego externo na DOCKER-USER, persistido pelo systemd.
- JVB anuncia o IPv4 público, sem candidatos privados. P2P fica desativado nesta implantação para usar o bridge validado. TURN ainda não está instalado; redes que bloqueiam UDP exigem validação e possível configuração adicional.
- Containers rootless/read-only, no-new-privileges, limites de CPU/RAM e logs com rotação. UID/GID1000 explícitos no tmpfs de /run são necessários com a proteção contra ganho de privilégios.

## Instalação e recuperação

`bootstrap.sh` é para uma VPS Ubuntu 24.04 limpa, executado por SSH como root após conferir a identidade do host e o acesso pela chave. Instala Docker do repositório oficial e Caddy/age/fail2ban dos repositórios Ubuntu. Ele restringe SSH ao IP da sessão; não executar sem acesso alternativo ao console. A instalação não redefine a senha da conta.

1. Preparar o host e restaurar `/opt/lessonara-classroom` a partir do backup criptografado, mantendo `.env` 0600 e diretório 0700.
2. Criar os volumes `config/{web,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,storage/prosody,storage/transcripts,storage/web,tmp/web-crontabs,tmp/web-load-test}` com UID/GID1000. O diretório raiz da implantação é de root, os volumes são do usuário dos containers.
3. Confirmar host/IP público na `.env`, Caddy e DNS. Preservar JWT_APP_ID/SECRET compatíveis com as variáveis privadas do backend. Rotacionar a chave JWT invalida tokens/salas em uso; coordenar a mudança.
4. Conferir os digests em `images.lock`, validar `docker compose config --quiet` sem imprimir configuração com segredos e iniciar `docker compose --parallel 1 pull` seguido de `docker compose up -d`.
5. Guardar somente o destinatário público age em `/root/lessonara-recovery/recipient.txt` (derivado da identidade no Mac com `age-keygen -y`; nunca copiar a identidade privada). Colocar scripts de operação em `/root/lessonara-setup`, executar `install-operations.sh` e conferir timers, firewall, HTTPS, JWT e mídia antes de liberar uso.

A chave de recuperação fica somente no Mac em `~/.ssh/lessonara_contabo_backup.agekey`; nunca na VPS ou no repositório. Os arquivos em `~/.ssh/lessonara-recovery/` são cópias criptografadas verificadas. Para extrair em diretório privado numa máquina com age:

```sh
umask 077
mkdir -p recovery
age -d -i ~/.ssh/lessonara_contabo_backup.agekey backup.tar.gz.age | tar -xzf - -C recovery
```

O arquivo `homelab-classroom-20261030.tar.gz.age` contém a PoC/stack antiga; o arquivo `homelab-classroom-system-20261030.tar.gz.age` contém a definição da LXC e a unidade do túnel. Arquivos `lessonara-config-*.tar.gz.age` são da VPS nova. São chaves/conteúdos distintos; não extrair em diretórios públicos ou publicar logs/configurações completas. A restauração completa em outra infraestrutura ainda requer exercício operacional.

## Backups e monitoramento

Backup criptografado diário da configuração na VPS, retenção de 14 dias, pelo `lessonara-classroom-backup.timer`. Não há gravações/transcrições nesta stack. Uma cópia inicial atual foi salva fora da VPS no Mac; transferência offsite recorrente ainda não foi automatizada. Guardar a identidade de recuperação em outro local seguro antes de depender somente do Mac.

Checagem local por minuto verifica quatro containers, HTTP interno, saúde do bridge e Caddy; falhas aparecem no systemd/journal. Não confundir isso com alerta externo: entrega de notificações e checagem independente do host ainda são pendentes.

## Evidências de 30/10/2026

- Ubuntu 24.04 x86-64, seis CPUs e aproximadamente 12 GB de RAM, VPS US East.
- Teste pelo domínio público HTTPS: professor owner, aluno member; ausência, assinatura inválida, expiração e token de outra sala negados.
- Focus criou sala sintética; bridge anunciou somente endereço público; checagem ICE/UDP autenticada da rede residencial à VPS respondeu. Sem contas ou aulas reais alteradas.
- Certificado público emitido e HTTPS200. Essas verificações não substituem câmera/áudio/compartilhamento entre dois participantes reais.
- Homelab: LXC103 e volume removidos após backup e validação pública; LXCs 101/102 preservadas. Conferir o registro final em `docs/classroom.md` e na documentação do home-server.
