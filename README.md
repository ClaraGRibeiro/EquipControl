# EquipControl

Aplicação web simples para cadastro, controle e monitoramento de equipamentos.

## Acesso

- Usuário: `adminotmg`
- Senha: `obsTransMG*2026`

A senha é validada no navegador usando Argon2id com salt e parâmetros de custo configurados no `app.js`.

## Funcionalidades

- Cadastro e edição de equipamentos
- Departamento, valor, quantidade e descrição
- Imagem por arquivo ou URL
- Status: Guardado, Em Uso e Manutenção
- Filtros e busca
- Atualização em massa de status
- Registros vinculados ao mesmo cadastro principal
- Exclusão com confirmação
- Desfazer exclusão por 3 segundos
- Exportação `.xlsx` com os dados e imagens incorporadas quando disponíveis
- Persistência local no navegador

## Observação sobre segurança

Esta é uma aplicação estática. O login é adequado para controle de acesso local à interface, mas não substitui autenticação de servidor para um ambiente multiusuário corporativo. Para segurança real entre computadores, o próximo passo é usar backend, banco de dados e sessões autenticadas no servidor.
