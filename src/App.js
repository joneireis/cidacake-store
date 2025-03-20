import React, { useState } from 'react';
import { PublicKey, Connection, TransactionInstruction, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import { Buffer } from 'buffer'; // Importar o Buffer
import './App.css';

const PROGRAM_ID = new PublicKey('nY3F2GFxvit5n6g1Ar6drGgSNcFYzwgixpcUxC9p722');
const CONNECTION = new Connection('https://api.devnet.solana.com', 'confirmed');
const OWNER_PUBKEY = new PublicKey('5ufohBPKyzfn8ZSFSGpuYJxgduwgkkgg4YrBwdY7JLKW');
const CAKE_ACCOUNT = new PublicKey('7m2eHqRfyLymQn17f4bTxyE2uNu9h39wpEv5QvX9Tyg1');
const OWNER_TOKEN_ACCOUNT = new PublicKey('5ufohBPKyzfn8ZSFSGpuYJxgduwgkkgg4YrBwdY7JLKW');

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [amount, setAmount] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [status, setStatus] = useState('');
  const [stock, setStock] = useState(null);
  const [price, setPrice] = useState(null);
  const [walletProvider, setWalletProvider] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [showContractInfo, setShowContractInfo] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);

  const connectWallet = async () => {
    try {
      console.log('Tentando conectar à carteira...');
      let provider;

      // Priorizar o Phantom (Solana)
      provider = window.solana;
      if (!provider || !provider.isPhantom) {
        throw new Error('Por favor, instale a carteira Phantom!');
      }
      // Forçar uma nova conexão
      await provider.connect({ onlyIfTrusted: false });
      const pubkey = provider.publicKey.toString();
      console.log('Carteira conectada:', pubkey);
      setWalletAddress(pubkey);
      setWalletProvider(provider);
      setStatus(`Carteira conectada: ${pubkey}`);

      // Consultar o estoque após conectar a carteira
      await fetchStock();
    } catch (error) {
      console.error('Erro ao conectar à carteira:', error);
      setStatus(`Erro: ${error.message}`);
    }
  };

  const disconnectWallet = async () => {
    try {
      if (window.solana) {
        await window.solana.disconnect();
        console.log('Carteira desconectada');
      }
      setWalletAddress(null);
      setWalletProvider(null);
      setStock(null);
      setPrice(null);
      setContractInfo(null);
      setShowContractInfo(false);
      setActiveMenu(null);
      setStatus('Carteira desconectada com sucesso!');
    } catch (error) {
      console.error('Erro ao desconectar carteira:', error);
      setStatus(`Erro ao desconectar: ${error.message}`);
    }
  };

  const initializeStock = async () => {
    try {
      setStatus('Inicializando estoque...');

      // Criar uma transação para inicializar a conta
      const transaction = new Transaction();

      // Verificar se a conta CAKE_ACCOUNT já existe e alocar espaço, se necessário
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo) {
        // Se a conta não existe, criá-la
        const space = 48; // Tamanho da CakeState (8 + 8 + 32 = 48 bytes)
        const lamports = await CONNECTION.getMinimumBalanceForRentExemption(space);
        const createAccountInstruction = SystemProgram.createAccount({
          fromPubkey: new PublicKey(walletAddress),
          newAccountPubkey: CAKE_ACCOUNT,
          lamports: lamports,
          space: space,
          programId: PROGRAM_ID,
        });
        transaction.add(createAccountInstruction);
      } else if (accountInfo.space < 48) {
        // Se a conta existe, mas o espaço é insuficiente, realocar
        const space = 48; // Tamanho da CakeState
        const lamports = await CONNECTION.getMinimumBalanceForRentExemption(space);
        const allocateInstruction = SystemProgram.allocate({
          accountPubkey: CAKE_ACCOUNT,
          space: space,
        });
        transaction.add(allocateInstruction);
      }

      // Instrução: Inicializar a conta (ID 0)
      const initializeInstruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: true },
          { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(walletAddress), isSigner: true, isWritable: false },
        ],
        data: Buffer.from([0]), // Instrução "initialize" (ID 0)
      });
      transaction.add(initializeInstruction);

      // Configurar a transação
      transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
      transaction.feePayer = new PublicKey(walletAddress);

      // Logar a transação antes de enviar
      console.log('Transação de inicialização:', transaction);

      // Assinar e enviar a transação
      const signedTx = await walletProvider.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize());
      await CONNECTION.confirmTransaction(txId);
      console.log('Conta inicializada, txId:', txId);
      setStatus(`Conta inicializada com sucesso! Tx: ${txId}`);

      // Verificar os dados da conta após a inicialização
      const updatedAccountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!updatedAccountInfo || !updatedAccountInfo.data) {
        console.log('Após inicialização - Dados da conta CAKE_ACCOUNT: vazia');
      } else {
        console.log('Após inicialização - Dados da conta CAKE_ACCOUNT:', updatedAccountInfo.data);
        console.log('Após inicialização - Tamanho do Buffer:', updatedAccountInfo.data.length);
        console.log('Após inicialização - Dados em Hex:', updatedAccountInfo.data.toString('hex'));
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
      console.log('Account Info:', accountInfo);
      if (!accountInfo || !accountInfo.data) {
        throw new Error('Não foi possível obter os dados da conta de estoque. A conta pode não estar inicializada.');
      }

      // Logar os dados da conta para inspeção
      console.log('Dados da conta CAKE_ACCOUNT:', accountInfo.data);
      console.log('Tamanho do Buffer:', accountInfo.data.length);
      console.log('Dados em Hex:', accountInfo.data.toString('hex'));

      // Verificar se há dados suficientes para ler a estrutura CakeState (48 bytes)
      if (accountInfo.data.length < 48) {
        throw new Error('Dados da conta muito curtos para conter a estrutura CakeState (necessita de 48 bytes).');
      }

      // Deserializar a estrutura CakeState
      const stockData = accountInfo.data.readBigUInt64LE(0); // stock (u64, 8 bytes)
      const priceData = accountInfo.data.readBigUInt64LE(8); // price (u64, 8 bytes)
      const ownerData = new PublicKey(accountInfo.data.slice(16, 48)); // owner (Pubkey, 32 bytes)

      console.log('Stock Data (BigInt):', stockData);
      console.log('Price Data (BigInt):', priceData);
      console.log('Owner Data:', ownerData.toString());

      const stockValue = Number(stockData);
      const priceValue = Number(priceData);

      console.log('Estoque de bolos:', stockValue);
      console.log('Preço por bolo (lamports):', priceValue);

      setStock(stockValue);
      setPrice(priceValue);
      setStatus(`Estoque de bolos: ${stockValue}, Preço por bolo: ${priceValue} lamports`);
    } catch (error) {
      console.error('Erro ao consultar estoque:', error);
      setStatus(`Erro ao consultar estoque: ${error.message}`);
    }
  };

  const updatePrice = async () => {
    if (!newPrice || newPrice <= 0) {
      setStatus('Insira um preço válido!');
      return;
    }

    try {
      setStatus('Atualizando preço...');

      // Criar a transação para atualizar o preço
      const transaction = new Transaction();

      // Instrução: Atualizar o preço (ID 2)
      const updatePriceData = Buffer.concat([
        Buffer.from([2]), // Instrução "update_price" (ID 2)
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(newPrice)]).buffer)), // Novo preço em lamports
      ]);

      const updatePriceInstruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: false }, // owner (somente leitura)
          { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true }, // cake_account (gravável)
          { pubkey: new PublicKey(walletAddress), isSigner: true, isWritable: false }, // signer
        ],
        data: updatePriceData,
      });

      transaction.add(updatePriceInstruction);

      // Configurar a transação
      transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
      transaction.feePayer = new PublicKey(walletAddress);

      // Logar a transação antes de enviar
      console.log('Transação de atualização de preço:', transaction);

      // Assinar e enviar a transação
      const signedTx = await walletProvider.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize());
      await CONNECTION.confirmTransaction(txId);
      console.log('Preço atualizado, txId:', txId);
      setStatus(`Preço atualizado com sucesso! Tx: ${txId}`);

      // Consultar o estoque e preço após atualizar
      await fetchStock();
    } catch (error) {
      console.error('Erro ao atualizar preço:', error);
      setStatus(`Erro ao atualizar preço: ${error.message}`);
    }
  };

  const fetchContractInfo = async () => {
    try {
      setStatus('Obtendo informações do contrato...');

      // Obter informações da conta CAKE_ACCOUNT
      const cakeAccountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      const cakeAccountBalance = cakeAccountInfo ? (cakeAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';
      const cakeAccountSpace = cakeAccountInfo ? cakeAccountInfo.space : 'N/A';
      const cakeAccountRentEpoch = cakeAccountInfo ? cakeAccountInfo.rentEpoch : 'N/A';
      const cakeAccountExecutable = cakeAccountInfo ? cakeAccountInfo.executable : 'N/A';

      // Obter informações da conta OWNER_PUBKEY
      const ownerAccountInfo = await CONNECTION.getAccountInfo(OWNER_PUBKEY);
      const ownerAccountBalance = ownerAccountInfo ? (ownerAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';

      // Obter informações da conta OWNER_TOKEN_ACCOUNT (conta de pagamentos)
      const ownerTokenAccountInfo = await CONNECTION.getAccountInfo(OWNER_TOKEN_ACCOUNT);
      const ownerTokenAccountBalance = ownerTokenAccountInfo ? (ownerTokenAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';

      // Verificar se OWNER_TOKEN_ACCOUNT é uma conta de token SPL e obter detalhes
      let tokenInfo = {};
      try {
        const tokenAccount = await getAccount(CONNECTION, OWNER_TOKEN_ACCOUNT);
        tokenInfo = {
          isTokenAccount: true,
          mint: tokenAccount.mint.toString(),
          tokenBalance: tokenAccount.amount.toString(),
          decimals: tokenAccount.decimals || 'N/A',
        };
      } catch (error) {
        tokenInfo = {
          isTokenAccount: false,
          mint: 'N/A',
          tokenBalance: 'N/A',
          decimals: 'N/A',
        };
      }

      // Obter informações do programa (PROGRAM_ID)
      const programInfo = await CONNECTION.getAccountInfo(PROGRAM_ID);
      const programBalance = programInfo ? (programInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';
      const programExecutable = programInfo ? programInfo.executable : 'N/A';

      const info = {
        programId: PROGRAM_ID.toString(),
        cakeAccount: CAKE_ACCOUNT.toString(),
        ownerPubkey: OWNER_PUBKEY.toString(),
        ownerTokenAccount: OWNER_TOKEN_ACCOUNT.toString(),
        cakeAccountBalance,
        cakeAccountSpace,
        cakeAccountRentEpoch,
        cakeAccountExecutable,
        ownerAccountBalance,
        ownerTokenAccountBalance,
        tokenInfo,
        programBalance,
        programExecutable,
      };
      setContractInfo(info);
      setShowContractInfo(true);
      setStatus('Informações do contrato obtidas com sucesso!');
    } catch (error) {
      console.error('Erro ao obter informações do contrato:', error);
      setStatus(`Erro ao obter informações do contrato: ${error.message}`);
    }
  };

  const buyCidacake = async () => {
    if (!amount || amount <= 0) {
      setStatus('Insira uma quantidade válida!');
      return;
    }

    try {
      setStatus('Processando compra...');
      const wallet = walletProvider;
      if (!wallet || !wallet.isConnected) {
        throw new Error('Conecte a carteira primeiro!');
      }

      // Verificar se a conta CAKE_ACCOUNT está inicializada
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo || !accountInfo.data || accountInfo.data.length < 48) {
        throw new Error('A conta CAKE_ACCOUNT não está inicializada. Clique em "Atualizar Estoque" para inicializá-la.');
      }

      const buyerPubkey = wallet.publicKey;
      const buyerTokenAccount = new PublicKey('7hJhA7P3QmPH37cth5ugpsMcsWk7iQBJqupSpE3W2AKu');

      // Verificar se OWNER_TOKEN_ACCOUNT é uma conta de token SPL válida
      let tokenInfo;
      try {
        tokenInfo = await getAccount(CONNECTION, OWNER_TOKEN_ACCOUNT);
      } catch (error) {
        throw new Error('A conta OWNER_TOKEN_ACCOUNT não é uma conta de token SPL válida. Configure uma conta de token válida para prosseguir.');
      }

      const sellData = Buffer.concat([
        Buffer.from([3]), // Instrução "sell" (ID 3)
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer)), // Quantidade de bolos
      ]);

      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: true }, // owner (gravável)
          { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true }, // cake_account (gravável)
          { pubkey: buyerPubkey, isSigner: true, isWritable: true }, // buyer (gravável, signer)
          { pubkey: buyerTokenAccount, isSigner: false, isWritable: true }, // buyer_token_account (gravável)
          { pubkey: OWNER_TOKEN_ACCOUNT, isSigner: false, isWritable: true }, // owner_token_account (gravável)
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program (somente leitura)
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program (somente leitura)
        ],
        data: sellData,
      });

      const transaction = new Transaction();
      transaction.add(instruction);
      transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
      transaction.feePayer = buyerPubkey;

      console.log('Transação pronta, assinando...');
      const signedTx = await walletProvider.signTransaction(transaction);
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
    <div className="App" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#333', textAlign: 'center', marginBottom: '20px' }}>Cidacake Store</h1>
      {walletAddress ? (
        <>
          <p style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
            Endereço da Carteira: <span style={{ fontFamily: 'monospace' }}>{walletAddress}</span>
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={() => setActiveMenu('buy')}
              style={{
                padding: '10px 20px',
                backgroundColor: activeMenu === 'buy' ? '#0056b3' : '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'buy' ? '#0056b3' : '#007bff')}
            >
              Compra de Bolos
            </button>
            <button
              onClick={() => { setActiveMenu('stock'); fetchStock(); }}
              style={{
                padding: '10px 20px',
                backgroundColor: activeMenu === 'stock' ? '#0056b3' : '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'stock' ? '#0056b3' : '#007bff')}
            >
              Saldo do Estoque
            </button>
            <button
              onClick={() => setActiveMenu('update')}
              style={{
                padding: '10px 20px',
                backgroundColor: activeMenu === 'update' ? '#0056b3' : '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'update' ? '#0056b3' : '#007bff')}
            >
              Atualizar Estoque e Preço
            </button>
            <button
              onClick={() => { setActiveMenu('contract'); fetchContractInfo(); }}
              style={{
                padding: '10px 20px',
                backgroundColor: activeMenu === 'contract' ? '#0056b3' : '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'contract' ? '#0056b3' : '#007bff')}
            >
              Informações do Contrato
            </button>
            <button
              onClick={disconnectWallet}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#c82333')}
              onMouseOut={(e) => (e.target.style.backgroundColor = '#dc3545')}
            >
              Desconectar da Carteira
            </button>
          </div>
          <div style={{ marginTop: '20px' }}>
            {activeMenu === 'buy' && (
              <div>
                <h2 style={{ color: '#333', marginBottom: '10px' }}>Compra de Bolos</h2>
                <input
                  type="number"
                  id="amount"
                  placeholder="Quantidade"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    padding: '10px',
                    marginRight: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
                <button
                  onClick={buyCidacake}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
                  onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
                >
                  Comprar
                </button>
              </div>
            )}
            {activeMenu === 'stock' && stock !== null && (
              <div>
                <h2 style={{ color: '#333', marginBottom: '10px' }}>Saldo do Estoque</h2>
                <p style={{ color: '#555' }}>{stock} bolos disponíveis</p>
                <p style={{ color: '#555' }}>Preço por bolo: {price} lamports</p>
              </div>
            )}
            {activeMenu === 'update' && (
              <div>
                <h2 style={{ color: '#333', marginBottom: '10px' }}>Atualizar Estoque e Preço</h2>
                <div style={{ marginBottom: '20px' }}>
                  <button
                    onClick={initializeStock}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      transition: 'background-color 0.3s',
                      marginRight: '10px',
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
                    onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
                  >
                    Atualizar Estoque
                  </button>
                </div>
                <div>
                  <input
                    type="number"
                    id="newPrice"
                    placeholder="Novo preço (lamports)"
                    min="1"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    style={{
                      padding: '10px',
                      marginRight: '10px',
                      border: '1px solid #ccc',
                      borderRadius: '5px',
                      fontSize: '16px',
                    }}
                  />
                  <button
                    onClick={updatePrice}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      transition: 'background-color 0.3s',
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
                    onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
                  >
                    Atualizar Preço
                  </button>
                </div>
              </div>
            )}
            {activeMenu === 'contract' && showContractInfo && contractInfo && (
              <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
                <h3 style={{ color: '#333', marginBottom: '20px', fontSize: '24px', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>
                  Informações do Contrato Cidacake
                </h3>
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Programa</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>ID do Programa</td>
                        <td style={{ padding: '12px', color: '#333', fontFamily: 'monospace' }}>{contractInfo.programId}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Saldo do Programa (SOL)</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.programBalance}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Programa Executável</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.programExecutable.toString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Conta de Estoque</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Conta de Estoque (CAKE_ACCOUNT)</td>
                        <td style={{ padding: '12px', color: '#333', fontFamily: 'monospace' }}>{contractInfo.cakeAccount}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Saldo da Conta de Estoque (SOL)</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.cakeAccountBalance}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Espaço Alocado (Bytes)</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.cakeAccountSpace}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Época de Aluguel (Rent Epoch)</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.cakeAccountRentEpoch}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Conta de Estoque Executável</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.cakeAccountExecutable.toString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Proprietário</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Conta do Proprietário (OWNER_PUBKEY)</td>
                        <td style={{ padding: '12px', color: '#333', fontFamily: 'monospace' }}>{contractInfo.ownerPubkey}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Saldo da Conta do Proprietário (SOL)</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.ownerAccountBalance}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Conta de Pagamentos</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Conta de Pagamentos (OWNER_TOKEN_ACCOUNT)</td>
                        <td style={{ padding: '12px', color: '#333', fontFamily: 'monospace' }}>{contractInfo.ownerTokenAccount}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>Saldo da Conta de Pagamentos (SOL)</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.ownerTokenAccountBalance}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', color: '#555' }}>É uma Conta de Token SPL?</td>
                        <td style={{ padding: '12px', color: '#333' }}>{contractInfo.tokenInfo.isTokenAccount ? 'Sim' : 'Não'}</td>
                      </tr>
                      {contractInfo.tokenInfo.isTokenAccount && (
                        <>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '12px', color: '#555' }}>Endereço do Token (Mint)</td>
                            <td style={{ padding: '12px', color: '#333', fontFamily: 'monospace' }}>{contractInfo.tokenInfo.mint}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '12px', color: '#555' }}>Saldo de Tokens</td>
                            <td style={{ padding: '12px', color: '#333' }}>{contractInfo.tokenInfo.tokenBalance}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '12px', color: '#555' }}>Decimais do Token</td>
                            <td style={{ padding: '12px', color: '#333' }}>{contractInfo.tokenInfo.decimals}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => setShowContractInfo(false)}
                  style={{
                    marginTop: '20px',
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
                  onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={connectWallet}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
          >
            Conectar Carteira
          </button>
        </div>
      )}
      <div id="status" style={{ color: '#555', textAlign: 'center', marginTop: '20px' }}>{status}</div>
    </div>
  );
}

export default App;