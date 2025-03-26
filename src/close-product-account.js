const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

async function closeProductAccount(productId) {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    const ownerKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/owner-wallet.json', 'utf-8')))
    );
    const cakeAccountKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/cidacake-account.json', 'utf-8')))
    );

    const CAKE_ACCOUNT = cakeAccountKeypair.publicKey;
    const OWNER_PUBKEY = ownerKeypair.publicKey;
    const PROGRAM_ID = new PublicKey('3FFzaQvjTsFJe9G4xPrFJEmFKbfm21R57C5jVX74YbWS'); // Substitua pelo novo PROGRAM_ID, se necessário

    console.log('CAKE_ACCOUNT:', CAKE_ACCOUNT.toString());
    console.log('OWNER_PUBKEY:', OWNER_PUBKEY.toString());
    console.log('PROGRAM_ID:', PROGRAM_ID.toString());
    console.log('Fechando product_account para product_id:', productId);

    const [productAccount] = await PublicKey.findProgramAddress(
        [Buffer.from('product'), Buffer.from(new BigUint64Array([BigInt(productId)]).buffer)],
        PROGRAM_ID
    );

    console.log('product_account:', productAccount.toString());

    console.log('Verificando o estado inicial da conta...');
    const accountInfo = await connection.getAccountInfo(productAccount);
    if (!accountInfo) {
        console.log('Conta não existe na blockchain.');
        return;
    }
    console.log('AccountInfo antes da transação:', accountInfo);
    console.log('Owner da conta:', accountInfo.owner.toString());
    console.log('Lamports na conta:', accountInfo.lamports);
    console.log('Dados da conta:', accountInfo.data.toString('hex'));

    const transaction = new Transaction();
    const closeProductData = new Uint8Array(9);
    closeProductData[0] = 7; // Instrução "close_product_account" (ID 7)
    const productIdBytes = new BigUint64Array([BigInt(productId)]);
    closeProductData.set(new Uint8Array(productIdBytes.buffer), 1);

    transaction.add(
        new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: false }, // 0: cake_account
                { pubkey: productAccount, isSigner: false, isWritable: true }, // 1: product_account
                { pubkey: OWNER_PUBKEY, isSigner: true, isWritable: true },  // 2: owner
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // 3: system_program
            ],
            data: closeProductData
        })
    );

    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = OWNER_PUBKEY;

    try {
        console.log('Enviando transação para fechar a conta...');
        const signature = await sendAndConfirmTransaction(connection, transaction, [ownerKeypair]);
        console.log('Conta fechada com sucesso! Lamports transferidos para OWNER_PUBKEY. Signature:', signature);

        console.log('Verificando o estado final da conta...');
        const updatedAccountInfo = await connection.getAccountInfo(productAccount);
        console.log('Updated AccountInfo:', updatedAccountInfo);
    } catch (err) {
        console.error('Erro:', err);
        if (err.getLogs) console.log('Logs:', await err.getLogs());
    }
}

// Fechar as contas para product_id 0 e 1
async function closeAllProductAccounts() {
    for (let productId = 0; productId <= 1; productId++) {
        await closeProductAccount(productId);
    }
}

closeAllProductAccounts().catch(err => {
    console.error('Erro geral:', err);
});