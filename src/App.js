import React, { useState, useEffect } from 'react';
import { PublicKey, Connection, TransactionInstruction, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import './App.css';

const PROGRAM_ID = new PublicKey('nY3F2GFxvit5n6g1Ar6drGgSNcFYzwgixpcUxC9p722');
const CONNECTION = new Connection('https://api.devnet.solana.com', 'confirmed');
const OWNER_PUBKEY = new PublicKey('yG9KfVSMZaMZHSY48KKxpvtdPZhbAMUsYsAfKZDUkW5');
const CAKE_ACCOUNT = new PublicKey('DBNGpwu4dcTvF8F6ogie2dxhpY4QeEkTVqe6p8xFtqbj');
const OWNER_TOKEN_ACCOUNT = new PublicKey('4YbgNnchNjJtXj62wMHfvogB6BU6Vbye947CZxfB9SrG');

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [newPrice, setNewPrice] = useState('');
  const [status, setStatus] = useState('');
  const [walletProvider, setWalletProvider] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [showContractInfo, setShowContractInfo] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState(() => {
    const savedHistory = localStorage.getItem('purchaseHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const [isAccountInitialized, setIsAccountInitialized] = useState(false);
  const [copyMessage, setCopyMessage] = useState(''); // Estado para mensagem de cópia

  useEffect(() => {
    localStorage.setItem('purchaseHistory', JSON.stringify(purchaseHistory));
  }, [purchaseHistory]);

  const connectWallet = async () => {
    try {
      console.log('Tentando conectar à carteira...');
      let provider = window.solana;
      if (!provider || !provider.isPhantom) {
        throw new Error('Por favor, instale a carteira Phantom!');
      }
      await provider.connect({ onlyIfTrusted: false });
      const pubkey = provider.publicKey.toString();
      console.log('Carteira conectada:', pubkey);
      setWalletAddress(pubkey);
      setWalletProvider(provider);
      setStatus(`Carteira conectada: ${pubkey}`);
      await checkAccountStatus();
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
      setContractInfo(null);
      setShowContractInfo(false);
      setActiveMenu(null);
      setProducts([]);
      setIsAccountInitialized(false);
      setStatus('Carteira desconectada com sucesso!');
    } catch (error) {
      console.error('Erro ao desconectar carteira:', error);
      setStatus(`Erro ao desconectar: ${error.message}`);
    }
  };

  const checkAccountStatus = async () => {
    try {
      console.log('Verificando o status da CAKE_ACCOUNT:', CAKE_ACCOUNT.toString());
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      console.log('AccountInfo:', accountInfo);
      if (!accountInfo) {
        console.log('Conta CAKE_ACCOUNT não existe.');
        setStatus('Conta CAKE_ACCOUNT não existe. Por favor, inicialize-a via Solana CLI.');
        setIsAccountInitialized(false);
        return;
      }
      console.log('Owner da conta:', accountInfo.owner.toString(), 'PROGRAM_ID esperado:', PROGRAM_ID.toString());
      if (accountInfo.owner.toString() !== PROGRAM_ID.toString()) {
        console.log('Conta CAKE_ACCOUNT não pertence ao programa correto.');
        setStatus('Conta CAKE_ACCOUNT não pertence ao programa correto. Por favor, inicialize-a novamente via Solana CLI.');
        setIsAccountInitialized(false);
        return;
      }
      console.log('Tamanho dos dados da conta:', accountInfo.data.length);
      if (accountInfo.data.length < 48) {
        console.log('Dados da conta muito curtos para conter a estrutura CakeState.');
        setStatus('Conta CAKE_ACCOUNT não está inicializada corretamente (dados insuficientes). Por favor, inicialize-a via Solana CLI.');
        setIsAccountInitialized(false);
        return;
      }
      console.log('Conta CAKE_ACCOUNT está inicializada corretamente.');
      setIsAccountInitialized(true);
    } catch (error) {
      console.error('Erro ao verificar o status da conta:', error);
      setStatus(`Erro ao verificar o status da conta: ${error.message}`);
      setIsAccountInitialized(false);
    }
  };

  useEffect(() => {
    if (isAccountInitialized) {
      console.log('isAccountInitialized mudou para true, chamando fetchProducts...');
      fetchProducts();
    }
  }, [isAccountInitialized]);

  const updatePrice = async () => {
    if (!newPrice || newPrice <= 0) {
      setStatus('Insira um preço válido!');
      return;
    }

    try {
      setStatus('Atualizando preço...');
      const transaction = new Transaction();
      const updatePriceData = new Uint8Array(9);
      updatePriceData[0] = 2; // Instrução "update_price" (ID 2)
      const priceBytes = new BigUint64Array([BigInt(newPrice)]);
      updatePriceData.set(new Uint8Array(priceBytes.buffer), 1);

      const updatePriceInstruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(walletAddress), isSigner: true, isWritable: false },
        ],
        data: updatePriceData,
      });

      transaction.add(updatePriceInstruction);
      transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
      transaction.feePayer = new PublicKey(walletAddress);

      const signedTx = await walletProvider.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize());
      await CONNECTION.confirmTransaction(txId);
      console.log('Preço atualizado, txId:', txId);
      setStatus(`Preço atualizado com sucesso! Tx: ${txId}`);
      await fetchProducts();
    } catch (error) {
      console.error('Erro ao atualizar preço:', error);
      setStatus(`Erro ao atualizar preço: ${error.message}`);
    }
  };

  const fetchProducts = async () => {
    try {
      console.log('Iniciando fetchProducts...');
      setStatus('Consultando produtos...');
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      console.log('AccountInfo em fetchProducts:', accountInfo);
      if (!accountInfo || !accountInfo.data) {
        throw new Error('Não foi possível obter os dados da conta de estoque. A conta pode não estar inicializada.');
      }

      if (accountInfo.owner.toString() !== PROGRAM_ID.toString()) {
        throw new Error('Conta CAKE_ACCOUNT não pertence ao programa correto.');
      }

      if (accountInfo.data.length < 48) {
        throw new Error('Dados da conta muito curtos para conter a estrutura CakeState (necessita de 48 bytes).');
      }

      const stockData = accountInfo.data.readBigUInt64LE(0);
      const priceData = accountInfo.data.readBigUInt64LE(8);
      const ownerData = new PublicKey(accountInfo.data.slice(16, 48));

      const stockValue = Number(stockData);
      const priceValue = Number(priceData);

      console.log('Estoque total de bolos:', stockValue);
      console.log('Preço base por bolo (lamports):', priceValue);
      console.log('Owner:', ownerData.toString());

      const derivedProducts = [
        { id: 1, name: 'Bolo de Chocolate', price: priceValue, stock: Math.floor(stockValue * 0.5) || 0 },
        { id: 2, name: 'Bolo de Morango', price: Math.floor(priceValue * 1.2), stock: Math.floor(stockValue * 0.3) || 0 },
        { id: 3, name: 'Bolo de Baunilha', price: Math.floor(priceValue * 0.8), stock: Math.floor(stockValue * 0.2) || 0 },
      ];

      console.log('Produtos derivados:', derivedProducts);
      setProducts(derivedProducts);
      setStatus(`Produtos carregados: Estoque total ${stockValue} bolos, Preço base ${priceValue} lamports`);
    } catch (error) {
      console.error('Erro ao consultar produtos:', error);
      setStatus(`Erro ao consultar produtos: ${error.message}`);
    }
  };

  const fetchContractInfo = async () => {
    try {
      setStatus('Obtendo informações do contrato...');
      const cakeAccountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      const cakeAccountBalance = cakeAccountInfo ? (cakeAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';
      const cakeAccountSpace = cakeAccountInfo ? cakeAccountInfo.space : 'N/A';
      const cakeAccountRentEpoch = cakeAccountInfo ? cakeAccountInfo.rentEpoch : 'N/A';
      const cakeAccountExecutable = cakeAccountInfo ? cakeAccountInfo.executable : 'N/A';

      const ownerAccountInfo = await CONNECTION.getAccountInfo(OWNER_PUBKEY);
      const ownerAccountBalance = ownerAccountInfo ? (cakeAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';

      const ownerTokenAccountInfo = await CONNECTION.getAccountInfo(OWNER_TOKEN_ACCOUNT);
      const ownerTokenAccountBalance = ownerTokenAccountInfo ? (ownerTokenAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';

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
        tokenInfo = { isTokenAccount: false, mint: 'N/A', tokenBalance: 'N/A', decimals: 'N/A' };
      }

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

  const buyCidacake = async (productId) => {
    const amount = amounts[productId] || '';
    if (!amount || amount <= 0) {
      setStatus('Insira uma quantidade válida para o produto selecionado!');
      return;
    }

    try {
      setStatus('Processando compra...');
      const wallet = walletProvider;
      if (!wallet || !wallet.isConnected) {
        throw new Error('Conecte a carteira primeiro!');
      }

      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo || !accountInfo.data || accountInfo.data.length < 48) {
        throw new Error('A conta CAKE_ACCOUNT não está inicializada.');
      }

      const buyerPubkey = wallet.publicKey;
      const buyerTokenAccount = new PublicKey('GwUA3r93pkMUYNLE59En8SMy2MBZfoLrSi7ntCFqcEgz');

      const sellData = new Uint8Array(9);
      sellData[0] = 3; // Instrução "sell" (ID 3)
      const amountBytes = new BigUint64Array([BigInt(amount)]);
      sellData.set(new Uint8Array(amountBytes.buffer), 1);

      const transaction = new Transaction().add(
        new TransactionInstruction({
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
        })
      );

      transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
      transaction.feePayer = buyerPubkey;

      const signedTx = await walletProvider.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize());
      await CONNECTION.confirmTransaction(txId);

      const product = products.find(p => p.id === productId);
      const totalPrice = product.price * amount;
      const purchase = {
        txId,
        productName: product.name,
        quantity: amount,
        totalPrice,
        date: new Date().toLocaleString(),
      };
      setPurchaseHistory(prev => [purchase, ...prev].slice(0, 10));
      setStatus(`Compra realizada! Tx: ${txId}`);
      await fetchProducts();
      setAmounts(prev => ({ ...prev, [productId]: '' }));
    } catch (error) {
      console.error('Erro ao processar compra:', error);
      setStatus(`Erro: ${error.message}`);
    }
  };

  const handleAmountChange = (productId, value) => {
    setAmounts(prev => ({ ...prev, [productId]: value }));
  };

  const copyTxId = async (txId) => {
    try {
      await navigator.clipboard.writeText(txId);
      setCopyMessage('TxID copiado!');
      setTimeout(() => setCopyMessage(''), 2000); // Limpar mensagem após 2 segundos
    } catch (error) {
      console.error('Erro ao copiar TxID:', error);
      setCopyMessage('Erro ao copiar TxID');
      setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.3s',
  };

  const copyButtonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 5px',
    verticalAlign: 'middle',
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
              onClick={() => setActiveMenu('products')}
              style={{
                ...buttonStyle,
                backgroundColor: activeMenu === 'products' ? '#0056b3' : '#007bff',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'products' ? '#0056b3' : '#007bff')}
            >
              Lista de Produtos
            </button>
            <button
              onClick={() => setActiveMenu('history')}
              style={{
                ...buttonStyle,
                backgroundColor: activeMenu === 'history' ? '#0056b3' : '#007bff',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'history' ? '#0056b3' : '#007bff')}
            >
              Histórico de Compras
            </button>
            <button
              onClick={() => setActiveMenu('update')}
              style={{
                ...buttonStyle,
                backgroundColor: activeMenu === 'update' ? '#0056b3' : '#007bff',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'update' ? '#0056b3' : '#007bff')}
            >
              Atualizar Preço
            </button>
            <button
              onClick={() => { setActiveMenu('contract'); fetchContractInfo(); }}
              style={{
                ...buttonStyle,
                backgroundColor: activeMenu === 'contract' ? '#0056b3' : '#007bff',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'contract' ? '#0056b3' : '#007bff')}
            >
              Informações do Contrato
            </button>
            <button
              onClick={disconnectWallet}
              style={{
                ...buttonStyle,
                backgroundColor: '#dc3545',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#c82333')}
              onMouseOut={(e) => (e.target.style.backgroundColor = '#dc3545')}
            >
              Desconectar da Carteira
            </button>
          </div>
          <div style={{ marginTop: '20px' }}>
            {activeMenu === 'products' && (
              <div>
                <h2 style={{ color: '#333', marginBottom: '10px' }}>Lista de Produtos</h2>
                {console.log('Renderizando Lista de Produtos, isAccountInitialized:', isAccountInitialized)}
                {isAccountInitialized && products.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px' }}>Nome</th>
                        <th style={{ padding: '12px' }}>Preço (lamports)</th>
                        <th style={{ padding: '12px' }}>Estoque</th>
                        <th style={{ padding: '12px' }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '12px' }}>{product.name}</td>
                          <td style={{ padding: '12px' }}>{product.price}</td>
                          <td style={{ padding: '12px' }}>{product.stock}</td>
                          <td style={{ padding: '12px' }}>
                            <input
                              type="number"
                              placeholder="Quantidade"
                              min="1"
                              value={amounts[product.id] || ''}
                              onChange={(e) => handleAmountChange(product.id, e.target.value)}
                              style={{ padding: '5px', marginRight: '5px', width: '80px' }}
                            />
                            <button
                              onClick={() => buyCidacake(product.id)}
                              style={{ padding: '5px 10px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '3px' }}
                            >
                              Comprar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>Conta CAKE_ACCOUNT não está inicializada. Por favor, inicialize-a via Solana CLI.</p>
                )}
              </div>
            )}
            {activeMenu === 'history' && (
              <div>
                <h2 style={{ color: '#333', marginBottom: '10px' }}>Histórico de Compras</h2>
                {purchaseHistory.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px' }}>Produto</th>
                        <th style={{ padding: '12px' }}>Quantidade</th>
                        <th style={{ padding: '12px' }}>Preço Total (lamports)</th>
                        <th style={{ padding: '12px' }}>Data</th>
                        <th style={{ padding: '12px' }}>TxID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseHistory.map((purchase, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '12px' }}>{purchase.productName}</td>
                          <td style={{ padding: '12px' }}>{purchase.quantity}</td>
                          <td style={{ padding: '12px' }}>{purchase.totalPrice}</td>
                          <td style={{ padding: '12px' }}>{purchase.date}</td>
                          <td style={{ padding: '12px', fontSize: '12px' }}>
                            {purchase.txId.slice(0, 10)}...
                            <button
                              onClick={() => copyTxId(purchase.txId)}
                              style={copyButtonStyle}
                              title="Copiar TxID completo"
                            >
                              📋
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>Nenhuma compra registrada ainda.</p>
                )}
                {copyMessage && (
                  <p style={{ color: '#28a745', textAlign: 'center', marginTop: '10px' }}>{copyMessage}</p>
                )}
              </div>
            )}
            {activeMenu === 'update' && (
              <div>
                <h2 style={{ color: '#333', marginBottom: '10px' }}>Atualizar Preço</h2>
                <div>
                  <input
                    type="number"
                    id="newPrice"
                    placeholder="Novo preço (lamports)"
                    min="1"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    style={{ padding: '10px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '16px' }}
                  />
                  <button
                    onClick={updatePrice}
                    style={{ ...buttonStyle }}
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
                  style={{ ...buttonStyle, marginTop: '20px' }}
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
            style={{ ...buttonStyle }}
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