const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

async function closeCakeAccount() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    const ownerKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/owner-wallet.json', 'utf-8')))
    );
    const cakeAccountKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/cidacake-account.json', 'utf-8')))
    );

    const CAKE_ACCOUNT = cakeAccountKeypair.publicKey;
    const OWNER_PUBKEY = ownerKeypair.publicKey;
    const PROGRAM_ID = new PublicKey('HwnyTMAjzFP6R85EtTj9kNiMMCS5DFULMSnpJXi71yL4'); // PROGRAM_ID antigo

    console.log('CAKE_ACCOUNT:', CAKE_ACCOUNT.toString());
    console.log('OWNER_PUBKEY:', OWNER_PUBKEY.toString());
    console.log('PROGRAM_ID:', PROGRAM_ID.toString());

    console.log('Verificando o estado inicial da conta...');
    const accountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
    if (!accountInfo) {
        console.log('Conta não existe na blockchain.');
        return;
    }
    console.log('AccountInfo antes da transação:', accountInfo);
    console.log('Owner da conta:', accountInfo.owner.toString());
    console.log('Lamports na conta:', accountInfo.lamports);
    console.log('Dados da conta:', accountInfo.data.toString('hex'));

    const transaction = new Transaction();
    transaction.add(
        new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true }, // 0: cake_account
                { pubkey: OWNER_PUBKEY, isSigner: true, isWritable: true },  // 1: owner
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // 2: system_program
            ],
            data: Buffer.from([6]) // Instrução "close_account" (ID 6)
        })
    );

    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = OWNER_PUBKEY;

    try {
        console.log('Enviando transação para fechar a conta...');
        const signature = await sendAndConfirmTransaction(connection, transaction, [ownerKeypair]);
        console.log('Conta fechada com sucesso! Lamports transferidos para OWNER_PUBKEY. Signature:', signature);

        console.log('Verificando o estado final da conta...');
        const updatedAccountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
        console.log('Updated AccountInfo:', updatedAccountInfo);
    } catch (err) {
        console.error('Erro:', err);
        if (err.getLogs) console.log('Logs:', await err.getLogs());
    }
}

closeCakeAccount().catch(err => {
    console.error('Erro geral:', err);
});