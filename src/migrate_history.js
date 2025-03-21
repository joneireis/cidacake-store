const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const os = require('os');

// Configurações
const OLD_PROGRAM_ID = new PublicKey('nY3F2GFxvit5n6g1Ar6drGgSNcFYzwgixpcUxC9p722');
const CONNECTION = new Connection('https://api.devnet.solana.com', 'confirmed');

// Carregar a chave privada do arquivo ~/owner-wallet.json
const walletPath = os.homedir() + '/owner-wallet.json';
console.log(`Carregando chave privada de: ${walletPath}`);
const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
const secretKey = Uint8Array.from(walletData);
const PAYER_KEYPAIR = Keypair.fromSecretKey(secretKey);
console.log(`Chave pública do pagador: ${PAYER_KEYPAIR.publicKey.toString()}`);

// Função para buscar todas as contas do programa antigo
async function fetchAllAccounts() {
    console.log('Buscando todas as contas do programa antigo...');
    const programAccounts = await CONNECTION.getProgramAccounts(OLD_PROGRAM_ID);

    console.log(`Encontradas ${programAccounts.length} contas no programa antigo.`);
    for (const account of programAccounts) {
        console.log(`Conta: ${account.pubkey.toString()}`);
        console.log(`Tamanho dos dados: ${account.account.data.length} bytes`);
        console.log(`Dados (hex): ${account.account.data.toString('hex')}`);
        console.log('---');
    }

    return programAccounts;
}

// Função principal para depuração
async function debugAccounts() {
    try {
        await fetchAllAccounts();
        console.log('Depuração concluída.');
    } catch (error) {
        console.error('Erro durante a depuração:', error);
    }
}

// Executar a depuração
debugAccounts();