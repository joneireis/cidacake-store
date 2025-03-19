# Cidacake Store

Cidacake Store é um site web3.0 descentralizado que permite aos usuários comprar bolos na rede Solana. O projeto utiliza autenticação via carteira Solana (Phantom), consulta de estoque on-chain, e transações para compras diretamente na blockchain. O frontend é construído com React e hospedado no IPFS para garantir descentralização.

## Descrição

Cidacake Store é uma aplicação de e-commerce descentralizada onde os usuários podem:
- Conectar sua carteira Solana (ex.: Phantom) para autenticação.
- Consultar o estoque de bolos disponível na blockchain.
- Comprar bolos pagando com SOL ou tokens SPL, com transações processadas on-chain.

O projeto é implantado na devnet da Solana e utiliza o programa Solana `cidacake-program` para gerenciar o estoque e processar compras.

## Arquitetura

A arquitetura do Cidacake Store segue os princípios da web3.0, com os seguintes componentes:

- **Hospedagem Descentralizada**: O frontend é hospedado no IPFS para garantir resistência a censura e falhas.
- **Frontend**: Construído com React, utilizando a biblioteca `@solana/web3.js` para interagir com a blockchain Solana.
- **Autenticação**: Autenticação baseada em carteira Solana (Phantom), onde a chave pública do usuário serve como identificador.
- **Lógica na Blockchain**: O programa Solana `cidacake-program` (ID: `nY3F2GFxvit5n6g1Ar6drGgSNcFYzwgixpcUxC9p722`) gerencia o estoque e processa transações.
- **Pagamentos**: Transações on-chain usando SOL ou tokens SPL, garantindo transparência e segurança.

### Endereços Importantes
- **Programa Solana**: `nY3F2GFxvit5n6g1Ar6drGgSNcFYzwgixpcUxC9p722`
- **Conta de Estoque (CAKE_ACCOUNT)**: `7m2eHqRfyLymQn17f4bTxyE2uNu9h39wpEv5QvX9Tyg1`
- **Conta do Proprietário (OWNER_PUBKEY)**: `5ufohBPKyzfn8ZSFSGpuYJxgduwgkkgg4YrBwdY7JLKW`

## Pré-requisitos

- **Node.js**: Versão 18.x (recomendado). Use `nvm` para gerenciar versões do Node.js.
- **Carteira Solana**: Instale a extensão Phantom no seu navegador ([Phantom Wallet](https://phantom.app/)).
- **IPFS**: Para hospedagem descentralizada (opcional, se você quiser hospedar localmente).

## Instalação

1. **Clone o Repositório** (se aplicável):
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd cidacake-store