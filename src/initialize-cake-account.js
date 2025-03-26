const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

async function initializeCakeAccount() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const ownerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/owner-wallet.json', 'utf-8')))
  );
  const cakeAccountKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/cidacake-account.json', 'utf-8')))
  );

  const CAKE_ACCOUNT = cakeAccountKeypair.publicKey;
  const OWNER_PUBKEY = ownerKeypair.publicKey;
  const PROGRAM_ID = new PublicKey('E66tS4TkkYWDYipfjVaRfSRbDGLGYF4oc9fKCwDxJt9'); // Corrigido

  console.log('CAKE_ACCOUNT:', CAKE_ACCOUNT.toString());
  console.log('OWNER_PUBKEY:', OWNER_PUBKEY.toString());
  console.log('PROGRAM_ID:', PROGRAM_ID.toString());

  const transaction = new Transaction();

  transaction.add(
    SystemProgram.allocate({
      accountPubkey: CAKE_ACCOUNT,
      space: 48 // 48 bytes, conforme CakeState::LEN (32 + 8 + 8)
    }),
    SystemProgram.assign({
      accountPubkey: CAKE_ACCOUNT,
      programId: PROGRAM_ID
    })
  );

  transaction.add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true }, // 0: cake_account
        { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: false }, // 1: owner
        { pubkey: OWNER_PUBKEY, isSigner: true, isWritable: true },  // 2: payer
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // 3: system_program
      ],
      data: Buffer.from([0]) // Instrução "initialize" (ID 0)
    })
  );

  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = OWNER_PUBKEY;

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [ownerKeypair, cakeAccountKeypair]);
    console.log('Conta criada e inicializada com sucesso! Signature:', signature);
    console.log('CAKE_ACCOUNT:', CAKE_ACCOUNT.toString());

    const accountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
    console.log('AccountInfo após inicialização:', accountInfo);
  } catch (err) {
    console.error('Erro:', err);
    if (err.getLogs) console.log('Logs:', await err.getLogs());
  }
}

initializeCakeAccount().catch(err => {
  console.error('Erro geral:', err);
});