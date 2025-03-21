const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

async function closeCakeAccount() {
    // Conexão com o Devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Carregar as carteiras
    const ownerKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync('/Users/joneirocha/owner-wallet.json', 'utf-8')))
    );
    const cakeAccountKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync('/Users/joneirocha/new-cidacake-account.json_', 'utf-8')))
    );

    const CAKE_ACCOUNT = cakeAccountKeypair.publicKey;
    const OWNER_PUBKEY = ownerKeypair.publicKey;
    const PROGRAM_ID = new PublicKey('9QdnR2gfx1hGVD7SfWzaVQLFS6CoVY7yGFrc8xGHDzaz'); // Substitua pelo novo PROGRAM_ID retornado pelo deploy

    console.log('CAKE_ACCOUNT:', CAKE_ACCOUNT.toString());
    console.log('OWNER_PUBKEY:', OWNER_PUBKEY.toString());

    // Verificar se a conta existe
    let accountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
    if (!accountInfo) {
        console.log('Conta não existe na blockchain.');
        return;
    }

    console.log('AccountInfo:', accountInfo);

    // Primeira transação: Chamar a instrução close_account para reatribuir a conta ao SystemProgram
    let transaction = new Transaction();

    // Instrução close_account (ID 5)
    const closeAccountInstruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true }, // 0: cake_account
            { pubkey: OWNER_PUBKEY, isSigner: true, isWritable: false }, // 1: owner
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 2: system_program
        ],
        data: new Uint8Array([5]), // Instrução "close_account" (ID 5)
    });
    transaction.add(closeAccountInstruction);

    // Definir o fee payer como OWNER_PUBKEY
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = OWNER_PUBKEY;

    // Enviar a primeira transação, assinando com ownerKeypair
    let signature = await sendAndConfirmTransaction(connection, transaction, [ownerKeypair]);
    console.log('Primeira transação: Conta reatribuída ao SystemProgram via close_account. Signature:', signature);

    // Verificar o estado da conta após a reatribuição
    accountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
    if (!accountInfo) {
        console.log('Conta não existe mais após a reatribuição.');
        return;
    }

    console.log('AccountInfo após reatribuição:', accountInfo);

    // Segunda transação: Transferir a maior parte dos lamports
    transaction = new Transaction();

    // Calcular o valor a transferir, deixando lamports suficientes para a taxa de transação
    let lamportsToTransfer = accountInfo.lamports - 5000; // Deixar 5_000 lamports para a taxa (1 assinatura)

    // Transferir os lamports da CAKE_ACCOUNT para a OWNER_PUBKEY
    let closeInstruction = SystemProgram.transfer({
        fromPubkey: CAKE_ACCOUNT,
        toPubkey: OWNER_PUBKEY,
        lamports: lamportsToTransfer, // Transferir todos os lamports menos a taxa
    });
    transaction.add(closeInstruction);

    // Definir o fee payer como OWNER_PUBKEY
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = OWNER_PUBKEY;

    // Enviar a segunda transação, assinando com ambas as chaves
    signature = await sendAndConfirmTransaction(connection, transaction, [cakeAccountKeypair, ownerKeypair]);
    console.log('Segunda transação: Lamports transferidos para OWNER_PUBKEY. Signature:', signature);

    // Verificar o estado da conta após a segunda transação
    accountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
    if (!accountInfo) {
        console.log('Conta foi completamente fechada após a segunda transação.');
        return;
    }

    console.log('AccountInfo após segunda transação:', accountInfo);

    // Terceira transação: Transferir os lamports restantes e fechar a conta
    transaction = new Transaction();
    lamportsToTransfer = accountInfo.lamports; // Transferir todos os lamports restantes

    closeInstruction = SystemProgram.transfer({
        fromPubkey: CAKE_ACCOUNT,
        toPubkey: OWNER_PUBKEY,
        lamports: lamportsToTransfer, // Transferir todos os lamports restantes
    });
    transaction.add(closeInstruction);

    // Definir o fee payer como OWNER_PUBKEY
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = OWNER_PUBKEY;

    // Enviar a terceira transação, assinando com ambas as chaves
    signature = await sendAndConfirmTransaction(connection, transaction, [cakeAccountKeypair, ownerKeypair]);
    console.log('Terceira transação: Conta fechada com sucesso! Lamports restantes transferidos para OWNER_PUBKEY. Signature:', signature);

    // Verificar se a conta foi fechada
    accountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
    if (!accountInfo) {
        console.log('Conta foi completamente fechada.');
    } else {
        console.log('Erro: Conta ainda existe com lamports:', accountInfo.lamports);
    }
}

closeCakeAccount().catch(err => {
    console.error('Erro:', err);
});