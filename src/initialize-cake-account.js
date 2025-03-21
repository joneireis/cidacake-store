const { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

async function initializeCakeAccount() {
  // Conexão com o Devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Carregar as carteiras
  const ownerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('/Users/joneirocha/owner-wallet.json', 'utf-8')))
  );
  const cakeAccountKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('/Users/joneirocha/new-cidacake-account.json', 'utf-8')))
  );

  const PROGRAM_ID = new PublicKey('9QdnR2gfx1hGVD7SfWzaVQLFS6CoVY7yGFrc8xGHDzaz'); // Novo PROGRAM_ID
  const CAKE_ACCOUNT = cakeAccountKeypair.publicKey;
  const OWNER_PUBKEY = ownerKeypair.publicKey;

  console.log('CAKE_ACCOUNT:', CAKE_ACCOUNT.toString());
  console.log('OWNER_PUBKEY:', OWNER_PUBKEY.toString());

  // Verificar se a conta já existe
  const accountInfo = await connection.getAccountInfo(CAKE_ACCOUNT);
  console.log('AccountInfo:', accountInfo);

  // Criar a transação
  let transaction = new Transaction();

  // Criar ou reatribuir a conta
  const space = 48; // Tamanho da CakeState (8 + 8 + 32)
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  if (!accountInfo) {
    console.log('AccountInfo retornou null. Tentando reatribuir a conta ao programa...');
    // Tentar reatribuir a conta ao programa (caso exista, mas o getAccountInfo falhou)
    const assignInstruction = SystemProgram.assign({
      accountPubkey: CAKE_ACCOUNT,
      programId: PROGRAM_ID,
    });
    transaction.add(assignInstruction);

    // Alocar espaço para a conta
    const allocateInstruction = SystemProgram.allocate({
      accountPubkey: CAKE_ACCOUNT,
      space: space,
    });
    transaction.add(allocateInstruction);

    // Inicializar a conta (instrução 0)
    console.log('Inicializando a conta...');
    const initializeInstruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true }, // cake_account
        { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: false }, // owner
        { pubkey: ownerKeypair.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      data: new Uint8Array([0, 255]), // Instrução "initialize" (ID 0) + bump seed
    });
    transaction.add(initializeInstruction);

    try {
      // Enviar a transação, assinando com ownerKeypair e cakeAccountKeypair
      const signature = await sendAndConfirmTransaction(connection, transaction, [ownerKeypair, cakeAccountKeypair]);
      console.log('Conta reatribuída e inicializada com sucesso! Signature:', signature);
      return;
    } catch (err) {
      console.log('Reatribuição falhou, provavelmente porque a conta não existe. Tentando criar a conta...');
      console.error('Erro na reatribuição:', err);
    }

    // Se a reatribuição falhar, tentar criar a conta
    transaction = new Transaction();
    console.log('Criando nova conta...');
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: ownerKeypair.publicKey,
      newAccountPubkey: CAKE_ACCOUNT,
      lamports: lamports,
      space: space,
      programId: PROGRAM_ID,
    });
    transaction.add(createAccountInstruction);
  } else {
    console.log('Conta já existe. Verificando se está inicializada...');
    if (accountInfo.data.length >= 48 && accountInfo.owner.toString() === PROGRAM_ID.toString()) {
      console.log('Conta já está inicializada corretamente.');
      return;
    }
    // Reatribuir a conta ao programa
    console.log('Reatribuindo conta ao programa...');
    const assignInstruction = SystemProgram.assign({
      accountPubkey: CAKE_ACCOUNT,
      programId: PROGRAM_ID,
    });
    transaction.add(assignInstruction);

    // Alocar espaço para a conta (se necessário)
    if (accountInfo.space !== space) {
      console.log('Alocando espaço para a conta...');
      const allocateInstruction = SystemProgram.allocate({
        accountPubkey: CAKE_ACCOUNT,
        space: space,
      });
      transaction.add(allocateInstruction);
    }
  }

  // Inicializar a conta (instrução 0)
  console.log('Inicializando a conta...');
  const initializeInstruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true }, // cake_account
      { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: false }, // owner
      { pubkey: ownerKeypair.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: new Uint8Array([0, 255]), // Instrução "initialize" (ID 0) + bump seed
  });
  transaction.add(initializeInstruction);

  // Definir o fee payer como OWNER_PUBKEY
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = ownerKeypair.publicKey;

  // Enviar a transação
  const signature = await sendAndConfirmTransaction(connection, transaction, [ownerKeypair, cakeAccountKeypair]);
  console.log('Conta criada e inicializada com sucesso! Signature:', signature);
}

initializeCakeAccount().catch(err => {
  console.error('Erro:', err);
});