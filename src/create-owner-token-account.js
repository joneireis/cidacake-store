const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createInitializeAccountInstruction } = require('@solana/spl-token');
const fs = require('fs');

async function createOwnerTokenAccount() {
  // Conexão com o Devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Carregar as carteiras
  const ownerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('/Users/joneirocha/owner-wallet.json', 'utf-8')))
  );
  const ownerTokenAccountKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('/Users/joneirocha/owner-token-account.json', 'utf-8')))
  );

  const TOKEN_MINT = new PublicKey('HHNeA8jUtUpFywdAqp3X4WWDMNiPEypJgW2Pk7XEKpcR');
  const OWNER_TOKEN_ACCOUNT = ownerTokenAccountKeypair.publicKey;
  const OWNER_PUBKEY = ownerKeypair.publicKey;

  console.log('OWNER_TOKEN_ACCOUNT:', OWNER_TOKEN_ACCOUNT.toString());
  console.log('OWNER_PUBKEY:', OWNER_PUBKEY.toString());

  // Verificar se a conta já existe
  const accountInfo = await connection.getAccountInfo(OWNER_TOKEN_ACCOUNT);
  if (accountInfo) {
    console.log('Conta já existe. Verificando se está inicializada...');
    if (accountInfo.owner.toString() === TOKEN_PROGRAM_ID.toString() && accountInfo.data.length === 165) {
      console.log('Conta já está inicializada corretamente como uma conta SPL.');
      return;
    }
  }

  // Criar a conta
  const space = 165; // Tamanho de uma conta SPL
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const transaction = new Transaction();

  if (!accountInfo) {
    // Criar a conta
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: ownerKeypair.publicKey,
      newAccountPubkey: OWNER_TOKEN_ACCOUNT,
      lamports: lamports,
      space: space,
      programId: TOKEN_PROGRAM_ID,
    });
    transaction.add(createAccountInstruction);
  } else if (accountInfo.owner.toString() !== TOKEN_PROGRAM_ID.toString()) {
    // Reatribuir a conta ao Token Program
    const assignInstruction = SystemProgram.assign({
      accountPubkey: OWNER_TOKEN_ACCOUNT,
      programId: TOKEN_PROGRAM_ID,
    });
    transaction.add(assignInstruction);
  }

  // Inicializar a conta SPL
  const initializeAccountInstruction = createInitializeAccountInstruction(
    OWNER_TOKEN_ACCOUNT, // Conta a ser inicializada
    TOKEN_MINT, // Mint do token
    OWNER_PUBKEY, // Dono da conta
    TOKEN_PROGRAM_ID // Programa de token
  );
  transaction.add(initializeAccountInstruction);

  // Enviar a transação
  const signature = await sendAndConfirmTransaction(connection, transaction, [ownerKeypair, ownerTokenAccountKeypair]);
  console.log('Conta SPL criada e inicializada com sucesso! Signature:', signature);
}

createOwnerTokenAccount().catch(err => {
  console.error('Erro:', err);
});
