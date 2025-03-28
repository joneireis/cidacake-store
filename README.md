# Cidacake Store - Frontend

Bem-vindo ao **Cidacake Store**, uma aplicação descentralizada (dApp) construída na blockchain Solana (Devnet) para venda de bolos, utilizando USDT como moeda de pagamento. Este repositório contém o frontend da dApp, desenvolvido em React, que interage com um programa Solana para gerenciar produtos, compras e histórico.

## Visão Geral

O Cidacake Store permite:
- **Proprietários**: Adicionar novos produtos (ex.: nome, descrição, preço em USDT, estoque).
- **Compradores**: Comprar produtos usando USDT, com transações registradas na blockchain.
- **Usuários**: Visualizar a lista de produtos, histórico de compras e informações detalhadas do contrato.

![alt text](cidacake-video.gif)

## Pré-requisitos

Antes de começar, você precisará de:
- **Node.js** (versão 16 ou superior) e **npm** ou **yarn**.
- Uma carteira Solana compatível, como a **Phantom Wallet**, instalada no navegador.
- Uma chave privada do proprietário (ex.: `yG9KfVSMZaMZHSY48KKxpvtdPZhbAMUsYsAfKZDUkW5`) para adicionar produtos.
- **Solana CLI** para inicializar a `CAKE_ACCOUNT` (opcional, mas necessário para recriar a conta após redeploy).
- Uma conta de token USDT na Devnet para o comprador (ex.: `5PmmgsYepReKZorTWXQMK6BoE9DbX6TXvcSgx3kUVCVP`).

## Configuração

### 1. Clone o Repositório
Clone o repositório do frontend:

```bash
git clone https://github.com/joneireis/cidacake-store.git
cd cidacake-store

### 2. Instale as Dependências
Instale as dependências do projeto:

```bash
npm install
```
Ou, se preferir usar Yarn:

```bash
yarn install
````

### 3. Configure o PROGRAM_ID e a CAKE_ACCOUNT
O frontend interage com um programa Solana. Você precisa configurar as seguintes constantes em src/App.js:

- **PROGRAM_ID**: O ID do programa Solana deployado. Atualmente:
```javascript
const PROGRAM_ID = new PublicKey('2A7wXZpFidpJ1ieRXMjaugYB2T96MQwUBDfq6YSuZjBC');
````
- **CAKE_ACCOUNT**: A conta de estoque associada ao programa. Após cada redeploy, você deve recriar essa conta usando o script initialize-cake-account.js (veja abaixo). Atualize o endereço em:

```javascript
const CAKE_ACCOUNT = new PublicKey('<novo_endereço_aqui>');
```
**Inicializar a CAKE_ACCOUNT**

Se o **PROGRAM_ID** mudar (ex.: após um redeploy), você precisa recriar a **CAKE_ACCOUNT**. Use o script initialize-cake-account.js:

1. Rode o arquivo **initialize-cake-account.js** no diretório raiz do projeto:
2. Substitua /caminho/para/sua/chave.json pelo caminho do arquivo JSON contendo a chave privada do proprietário.
3. Execute o script:
```bash
node initialize-cake-account.js
```
4. Atualize o **CAKE_ACCOUNT** em src/App.js com o novo endereço gerado.

### 4. Inicie o Frontend ###
Inicie o servidor de desenvolvimento:

```bash
npm start
```
Ou com Yarn:

```bash
yarn start
```
O frontend estará disponível em http://localhost:3000.