import React, { useState } from 'react';
import { PublicKey, Connection, TransactionInstruction, Transaction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import './App.css';

const PROGRAM_ID = new PublicKey('nY3F2GFxvit5n6g1Ar6drGgSNcFYzwgixpcUxC9p722');
const CONNECTION = new Connection('https://api.devnet.solana.com', 'confirmed');
const OWNER_PUBKEY = new PublicKey('5ufohBPKyzfn8ZSFSGpuYJxgduwgkkgg4YrBwdY7JLKW');
const CAKE_ACCOUNT = new PublicKey('7m2eHqRfyLymQn17f4bTxyE2uNu9h39wpEv5QvX9Tyg1');
const OWNER_TOKEN_ACCOUNT = new PublicKey('5ufohBPKyzfn8ZSFSGpuYJxgduwgkkgg4YrBwdY7JLKW');

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [stock, setStock] = useState(null);

  const connectWallet = async () => {
    try {
      console.log('Tentando conectar carteira...');
      console.log('window.solana:', window.solana);
      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Por favor, instale a carteira Phantom!');
      }
      await window.solana.connect();
      const pubkey = window.solana.publicKey.toString();
      console.log('Carteira conectada:', pubkey);
      setWalletAddress(pubkey);
      setStatus(`Carteira conectada: ${pubkey}`);
      // Consultar o estoque após conectar a carteira
      await fetchStock();
    } catch (error) {
      console.error('Erro ao conectar carteira:', error);
      setStatus(`Erro: ${error.message}`);
    }
  };

  const initializeStock = async () => {
    try {
      setStatus('Inicializando estoque...');
      // Criar uma instrução para inicializar a conta (ID 0)
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: true },
          { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(walletAddress), isSigner: true, isWritable: false },
        ],
        data: Buffer.from([0]), // Instrução "initialize" (ID 0)
      });

      // Criar uma transação para inicializar a conta
      const transaction = new Transaction();
      transaction.add(instruction);
      transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
      transaction.feePayer = new PublicKey(walletAddress);

      // Logar a transação antes de enviar
      console.log('Transação de inicialização:', transaction);

      // Assinar e enviar a transação
      const signedTx = await window.solana.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize());
      await CONNECTION.confirmTransaction(txId);
      console.log('Conta inicializada, txId:', txId);
      setStatus(`Conta inicializada com sucesso! Tx: ${txId}`);

      // Verificar os dados da conta após a inicialização
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo || !accountInfo.data) {
        console.log('Após inicialização - Dados da conta CAKE_ACCOUNT: vazia');
      } else {
        console.log('Após inicialização - Dados da conta CAKE_ACCOUNT:', accountInfo.data);
        console.log('Após inicialização - Tamanho do Buffer:', accountInfo.data.length);
        console.log('Após inicialização - Dados em Hex:', accountInfo.data.toString('hex'));
      }

      // Consultar o estoque após inicializar
      await fetchStock();
    } catch (error) {
      console.error('Erro ao inicializar estoque:', error);
      setStatus(`Erro ao inicializar estoque: ${error.message}`);
    }
  };

  const fetchStock = async () => {
    try {
      setStatus('Consultando estoque...');
      // Obter os dados da conta CAKE_ACCOUNT diretamente
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo || !accountInfo.data) {
        throw new Error('Não foi possível obter os dados da conta de estoque. A conta pode não estar inicializada.');
      }

      // Logar os dados da conta para inspeção
      console.log('Dados da conta CAKE_ACCOUNT:', accountInfo.data);
      console.log('Tamanho do Buffer:', accountInfo.data.length);
      console.log('Dados em Hex:', accountInfo.data.toString('hex'));

      // Verificar se há dados suficientes para ler um u64 (8 bytes)
      if (accountInfo.data.length < 8) {
        throw new Error('Dados da conta muito curtos para conter um u64 (necessita de 8 bytes).');
      }

      // Ler o estoque como um u64 (8 bytes) a partir do offset 0
      const stockData = accountInfo.data.readBigUInt64LE(0);
      console.log('Stock Data (BigInt):', stockData);
      const stockValue = Number(stockData);
      console.log('Estoque de bolos:', stockValue);
      setStock(stockValue);
      setStatus(`Estoque de bolos: ${stockValue}`);
    } catch (error) {
      console.error('Erro ao consultar estoque:', error);
      setStatus(`Erro ao consultar estoque: ${error.message}`);
    }
  };

  const buyCidacake = async () => {
    if (!amount || amount <= 0) {
      setStatus('Insira uma quantidade válida!');
      return;
    }

    try {
      setStatus('Processando compra...');
      const wallet = window.solana;
      if (!wallet.isConnected) {
        throw new Error('Conecte a carteira primeiro!');
      }

      const buyerPubkey = wallet.publicKey;
      const buyerTokenAccount = new PublicKey('7hJhA7P3QmPH37cth5ugpsMcsWk7iQBJqupSpE3W2AKu');

      const sellData = Buffer.concat([
        Buffer.from([3]),
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer)),
      ]);

      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: true },
          { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: buyerPubkey, isSigner: true, isWritable: true },
          { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
          { pubkey: OWNER_TOKEN_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: sellData,
      });

      const transaction = new Transaction();
      transaction.add(instruction);
      transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
      transaction.feePayer = buyerPubkey;

      console.log('Transação pronta, assinando...');
      const signedTx = await wallet.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize());
      await CONNECTION.confirmTransaction(txId);
      console.log('Compra concluída, txId:', txId);
      setStatus(`Compra realizada! Tx: ${txId}`);
      // Atualizar o estoque após a compra
      await fetchStock();
    } catch (error) {
      console.error('Erro ao processar compra:', error);
      setStatus(`Erro: ${error.message}`);
    }
  };

  return (
    <div className="App">
      <h1>Cidacake Store</h1>
      {walletAddress ? (
        <>
          <p>Endereço da Carteira: {walletAddress}</p>
          <button onClick={initializeStock}>Inicializar Estoque</button>
        </>
      ) : (
        <button onClick={connectWallet}>Conectar Carteira</button>
      )}
      <div id="status">{status}</div>
      {stock !== null && (
        <div>
          <h2>Estoque de Bolos</h2>
          <p>{stock} bolos disponíveis</p>
        </div>
      )}
      <h2>Comprar Bolos</h2>
      <input
        type="number"
        id="amount"
        placeholder="Quantidade"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={buyCidacake}>Comprar</button>
    </div>
  );
}

export default App;