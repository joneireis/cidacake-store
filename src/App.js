import React, { useState, useEffect } from 'react';
import { Connection, PublicKey, SystemProgram, TransactionInstruction, Transaction, LAMPORTS_PER_SOL, SendTransactionError } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { Buffer } from 'buffer';
import './App.css';

window.Buffer = Buffer;

const PROGRAM_ID = new PublicKey('2A7wXZpFidpJ1ieRXMjaugYB2T96MQwUBDfq6YSuZjBC');
const CONNECTION = new Connection('https://api.devnet.solana.com', 'confirmed');
const OWNER_PUBKEY = new PublicKey('yG9KfVSMZaMZHSY48KKxpvtdPZhbAMUsYsAfKZDUkW5');
const CAKE_ACCOUNT = new PublicKey('Gxh7BG5mTAiZ9MPBNtqnL2XXSf6Q4pa3mFCLjT6s1Qsm');
const OWNER_TOKEN_ACCOUNT = new PublicKey('AP1B1X3QYVo54LDreFgeAxhCULhqrQw89tffiDHBGKhf');
const USDT_MINT = new PublicKey('9V3992f9PJup6T1AGiXeBNzp2VE7zDjXkJj7Df4g9vxr');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const PurchaseHistory = {
  LEN: 57,

  unpack_from_slice(src) {
    if (src.length !== this.LEN) {
      throw new Error('Dados inválidos para PurchaseHistory: tamanho incorreto');
    }

    const product_id = src[0];
    const quantity = src.readBigUInt64LE(1);
    const total_price = src.readBigUInt64LE(9);
    const buyer = new PublicKey(src.slice(17, 49));
    const timestamp = src.readBigInt64LE(49);

    return {
      product_id,
      quantity,
      total_price,
      buyer,
      timestamp,
    };
  },
};

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', initialStock: '' });
  const [status, setStatus] = useState('');
  const [walletProvider, setWalletProvider] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [showContractInfo, setShowContractInfo] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [isAccountInitialized, setIsAccountInitialized] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const connectWallet = async () => {
    try {
      let provider = window.solana;
      if (!provider || !provider.isPhantom) {
        throw new Error('Por favor, instale a carteira Phantom!');
      }
      await provider.connect({ onlyIfTrusted: false });
      const pubkey = provider.publicKey.toString();
      setWalletAddress(pubkey);
      setWalletProvider(provider);
      setStatus(`Carteira conectada: ${pubkey}`);
      await checkAccountStatus();
      await fetchPurchaseHistory();
    } catch (error) {
      console.error('Erro ao conectar à carteira:', error);
      setStatus(`Erro: ${error.message}`);
    }
  };

  const fetchHistoryCounter = async () => {
    try {
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo || !accountInfo.data) {
        throw new Error('Não foi possível obter os dados da conta de estoque.');
      }
      return Number(accountInfo.data.readBigUInt64LE(40));
    } catch (error) {
      console.error('Erro ao buscar history_counter:', error);
      return 0;
    }
  };

  const disconnectWallet = async () => {
    try {
      if (window.solana) {
        await window.solana.disconnect();
      }
      setWalletAddress(null);
      setWalletProvider(null);
      setContractInfo(null);
      setShowContractInfo(false);
      setActiveMenu(null);
      setProducts([]);
      setPurchaseHistory([]);
      setIsAccountInitialized(false);
      setStatus('Carteira desconectada com sucesso!');
    } catch (error) {
      console.error('Erro ao desconectar carteira:', error);
      setStatus(`Erro ao desconectar: ${error.message}`);
    }
  };

  const checkAccountStatus = async () => {
    try {
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo) {
        setStatus('Conta CAKE_ACCOUNT não existe. Por favor, inicialize-a via Solana CLI.');
        setIsAccountInitialized(false);
        return;
      }
      if (accountInfo.owner.toString() !== PROGRAM_ID.toString()) {
        setStatus('Conta CAKE_ACCOUNT não pertence ao programa correto.');
        setIsAccountInitialized(false);
        return;
      }
      if (accountInfo.data.length < 40) {
        setStatus('Conta CAKE_ACCOUNT não está inicializada corretamente.');
        setIsAccountInitialized(false);
        return;
      }
      setIsAccountInitialized(true);
    } catch (error) {
      console.error('Erro ao verificar o status da conta:', error);
      setStatus(`Erro ao verificar o status da conta: ${error.message}`);
      setIsAccountInitialized(false);
    }
  };

  useEffect(() => {
    if (isAccountInitialized) {
      fetchProducts();
    }
  }, [isAccountInitialized]);

  const fetchPurchaseHistory = async () => {
    try {
      setStatus('Carregando histórico de compras...');
      const programAccounts = await CONNECTION.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: PurchaseHistory.LEN }],
      });

      if (!programAccounts || programAccounts.length === 0) {
        setPurchaseHistory([]);
        setStatus('Nenhuma compra encontrada na blockchain.');
        return;
      }

      const history = [];
      for (const account of programAccounts) {
        const data = account.account.data;
        const purchase = PurchaseHistory.unpack_from_slice(data);

        const product = products.find(p => p.id === purchase.product_id);
        const productName = product ? product.name : `Produto ${purchase.product_id}`;
        const date = new Date(Number(purchase.timestamp) * 1000).toLocaleString();

        history.push({
          txId: account.pubkey.toString(),
          productName,
          quantity: purchase.quantity.toString(),
          totalPrice: purchase.total_price.toString(),
          date,
          buyer: purchase.buyer.toString(),
        });
      }

      setPurchaseHistory(history.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10));
      setStatus('Histórico de compras carregado com sucesso!');
    } catch (error) {
      console.error('Erro ao buscar histórico de compras:', error);
      setStatus(`Erro ao carregar histórico de compras: ${error.message}`);
    }
  };

  const addProduct = async () => {
    const { name, description, price, initialStock } = newProduct;
    if (!name || !description || !price || !initialStock || price <= 0 || initialStock < 0) {
      setStatus('Preencha todos os campos corretamente!');
      return;
    }

    if (walletAddress !== OWNER_PUBKEY.toString()) {
      setStatus('Apenas o proprietário pode adicionar produtos!');
      return;
    }

    try {
      setStatus('Adicionando novo produto...');
      const transaction = new Transaction();

      const productId = (await fetchProductCounter()) || 0;
      const [productAccount, bump] = await PublicKey.findProgramAddress(
        [Buffer.from('product'), Buffer.from(new BigUint64Array([BigInt(productId)]).buffer)],
        PROGRAM_ID
      );
      console.log('Product Account:', productAccount.toString());
      console.log('Bump:', bump);

      const addProductData = new Uint8Array(177);
      addProductData[0] = 1; // Instrução "add_product"

      const nameBytes = new TextEncoder().encode(name.padEnd(32, '\0').slice(0, 32));
      const descriptionBytes = new TextEncoder().encode(description.padEnd(128, '\0').slice(0, 128));
      const priceInLamports = BigInt(Math.round(parseFloat(price) * 1000000));
      const priceBytes = new BigUint64Array([priceInLamports]);
      const stockBytes = new BigUint64Array([BigInt(initialStock)]);

      addProductData.set(nameBytes, 1);
      addProductData.set(descriptionBytes, 33);
      addProductData.set(new Uint8Array(priceBytes.buffer), 161);
      addProductData.set(new Uint8Array(stockBytes.buffer), 169);

      const addProductInstruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true },
          { pubkey: productAccount, isSigner: false, isWritable: true },
          { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: walletProvider.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: addProductData,
      });

      transaction.add(addProductInstruction);

      const { blockhash, lastValidBlockHeight } = await CONNECTION.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletProvider.publicKey;
      console.log('Blockhash:', blockhash);
      console.log('Last Valid Block Height:', lastValidBlockHeight);
      console.log('Fee Payer:', walletProvider.publicKey.toString());
      console.log('Wallet Address:', walletAddress);

      const signedTx = await walletProvider.signTransaction(transaction);
      console.log('Transação assinada.');

      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });
      console.log('Transação enviada. TxId:', txId);

      await CONNECTION.confirmTransaction({
        signature: txId,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
      }, 'confirmed', { commitment: 'confirmed', timeout: 60000 });
      console.log('Transação confirmada.');

      setStatus(`Produto adicionado com sucesso! Tx: ${txId}`);
      setNewProduct({ name: '', description: '', price: '', initialStock: '' });
      await fetchProducts();
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      setStatus(`Erro ao adicionar produto: ${error.message}`);
    }
  };

  const fetchProductCounter = async () => {
    try {
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo || !accountInfo.data) {
        throw new Error('Não foi possível obter os dados da conta de estoque.');
      }
      return Number(accountInfo.data.readBigUInt64LE(32));
    } catch (error) {
      console.error('Erro ao buscar product_counter:', error);
      return 0;
    }
  };

  const fetchProducts = async () => {
    try {
      setStatus('Consultando produtos...');
      const accountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!accountInfo || !accountInfo.data) {
        throw new Error('Não foi possível obter os dados da conta de estoque.');
      }

      const productCounter = Number(accountInfo.data.readBigUInt64LE(32));
      const fetchedProducts = [];

      for (let productId = 0; productId < productCounter; productId++) {
        const [productAccount] = await PublicKey.findProgramAddress(
          [Buffer.from('product'), Buffer.from(new BigUint64Array([BigInt(productId)]).buffer)],
          PROGRAM_ID
        );

        const productInfo = await CONNECTION.getAccountInfo(productAccount);
        if (!productInfo || !productInfo.data) continue;

        const id = Number(productInfo.data.readBigUInt64LE(0));
        const nameBytes = productInfo.data.slice(8, 40);
        const name = new TextDecoder().decode(nameBytes).replace(/\0/g, '');
        const descriptionBytes = productInfo.data.slice(40, 168);
        const description = new TextDecoder().decode(descriptionBytes).replace(/\0/g, '');
        const price = Number(productInfo.data.readBigUInt64LE(168));
        const stock = Number(productInfo.data.readBigUInt64LE(176));

        fetchedProducts.push({ id, name, description, price, stock });
      }

      setProducts(fetchedProducts);
      setStatus(`Produtos carregados: ${fetchedProducts.length} bolos encontrados.`);
    } catch (error) {
      console.error('Erro ao consultar produtos:', error);
      setStatus(`Erro ao consultar produtos: ${error.message}`);
    }
  };

  const fetchContractInfo = async () => {
    try {
      setStatus('Obtendo informações detalhadas do contrato...');

      // Informações básicas da CAKE_ACCOUNT
      const cakeAccountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!cakeAccountInfo) throw new Error('CAKE_ACCOUNT não encontrada.');
      const cakeAccountBalance = (cakeAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4);
      const cakeAccountSpace = cakeAccountInfo.space;
      const cakeAccountRentEpoch = cakeAccountInfo.rentEpoch;
      const cakeAccountExecutable = cakeAccountInfo.executable;

      // Extrair product_counter e history_counter como Number
      const productCounter = Number(cakeAccountInfo.data.readBigUInt64LE(32));
      const historyCounter = Number(cakeAccountInfo.data.readBigUInt64LE(40));

      // Informações do OWNER_PUBKEY
      const ownerAccountInfo = await CONNECTION.getAccountInfo(OWNER_PUBKEY);
      const ownerAccountBalance = ownerAccountInfo ? (ownerAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';

      // Informações da OWNER_TOKEN_ACCOUNT (USDT)
      const ownerTokenAccountInfo = await getAccount(CONNECTION, OWNER_TOKEN_ACCOUNT);
      const ownerTokenBalance = Number(ownerTokenAccountInfo.amount) / 10 ** 6; // Convertendo BigInt para Number
      const ownerTokenMint = ownerTokenAccountInfo.mint.toString();

      // Informações da BUYER_TOKEN_ACCOUNT (USDT)
      const buyerTokenAccount = new PublicKey('5PmmgsYepReKZorTWXQMK6BoE9DbX6TXvcSgx3kUVCVP');
      const buyerTokenAccountInfo = await getAccount(CONNECTION, buyerTokenAccount);
      const buyerTokenBalance = Number(buyerTokenAccountInfo.amount) / 10 ** 6; // Convertendo BigInt para Number

      // Informações do PROGRAM_ID
      const programInfo = await CONNECTION.getAccountInfo(PROGRAM_ID);
      const programBalance = programInfo ? (programInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';
      const programExecutable = programInfo ? programInfo.executable : 'N/A';

      // Lista de produtos
      const productsList = [];
      for (let productId = 0; productId < productCounter; productId++) {
        const [productAccount] = await PublicKey.findProgramAddress(
          [Buffer.from('product'), Buffer.from(new BigUint64Array([BigInt(productId)]).buffer)],
          PROGRAM_ID
        );
        const productInfo = await CONNECTION.getAccountInfo(productAccount);
        if (productInfo && productInfo.data) {
          const id = Number(productInfo.data.readBigUInt64LE(0)); // Convertendo BigInt
          const nameBytes = productInfo.data.slice(8, 40);
          const name = new TextDecoder().decode(nameBytes).replace(/\0/g, '');
          const descriptionBytes = productInfo.data.slice(40, 168);
          const description = new TextDecoder().decode(descriptionBytes).replace(/\0/g, '');
          const price = Number(productInfo.data.readBigUInt64LE(168)) / 10 ** 6; // Convertendo BigInt
          const stock = Number(productInfo.data.readBigUInt64LE(176)); // Convertendo BigInt
          productsList.push({ id, name, description, price, stock });
        }
      }

      // Última compra (se existir)
      let lastPurchase = null;
      if (historyCounter > 0) {
        const programAccounts = await CONNECTION.getProgramAccounts(PROGRAM_ID, {
          filters: [{ dataSize: PurchaseHistory.LEN }],
        });
        if (programAccounts.length > 0) {
          const latestAccount = programAccounts.sort((a, b) => {
            const aTimestamp = Number(a.account.data.readBigInt64LE(49)); // Convertendo BigInt
            const bTimestamp = Number(b.account.data.readBigInt64LE(49)); // Convertendo BigInt
            return bTimestamp - aTimestamp;
          })[0];
          const purchase = PurchaseHistory.unpack_from_slice(latestAccount.account.data);
          const product = productsList.find(p => p.id === purchase.product_id) || { name: `Produto ${purchase.product_id}` };
          lastPurchase = {
            productName: product.name,
            quantity: Number(purchase.quantity), // Convertendo BigInt
            totalPrice: (Number(purchase.total_price) / 10 ** 6).toFixed(2), // Convertendo BigInt
            buyer: purchase.buyer.toString(),
            timestamp: new Date(Number(purchase.timestamp) * 1000).toLocaleString(), // Convertendo BigInt
          };
        }
      }

      // Montar objeto com todas as informações
      const info = {
        programId: PROGRAM_ID.toString(),
        cakeAccount: CAKE_ACCOUNT.toString(),
        ownerPubkey: OWNER_PUBKEY.toString(),
        ownerTokenAccount: OWNER_TOKEN_ACCOUNT.toString(),
        buyerTokenAccount: buyerTokenAccount.toString(),
        cakeAccountBalance,
        cakeAccountSpace,
        cakeAccountRentEpoch,
        cakeAccountExecutable,
        productCounter,
        historyCounter,
        ownerAccountBalance,
        ownerTokenBalance: ownerTokenBalance.toFixed(2),
        ownerTokenMint,
        buyerTokenBalance: buyerTokenBalance.toFixed(2),
        programBalance,
        programExecutable,
        products: productsList,
        lastPurchase,
      };

      setContractInfo(info);
      setShowContractInfo(true);
      setStatus('Informações detalhadas do contrato obtidas com sucesso!');
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
      const [productAccount] = await PublicKey.findProgramAddress(
        [Buffer.from('product'), Buffer.from(new BigUint64Array([BigInt(productId)]).buffer)],
        PROGRAM_ID
      );

      const historyIndex = await fetchHistoryCounter();
      const [historyAccount, historyBump] = await PublicKey.findProgramAddress(
        [
          Buffer.from('history'),
          Buffer.from(buyerPubkey.toBytes()),
          Buffer.from(new BigUint64Array([BigInt(productId)]).buffer),
          Buffer.from(new BigUint64Array([BigInt(historyIndex)]).buffer),
        ],
        PROGRAM_ID
      );

      const buyerTokenAccount = new PublicKey('5PmmgsYepReKZorTWXQMK6BoE9DbX6TXvcSgx3kUVCVP');
      const ownerTokenAccount = OWNER_TOKEN_ACCOUNT;

      const sellData = new Uint8Array(17);
      sellData[0] = 4; // "sell" instruction
      sellData.set(new Uint8Array(new BigUint64Array([BigInt(productId)]).buffer), 1);
      sellData.set(new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer), 9);

      const transaction = new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: OWNER_PUBKEY, isSigner: false, isWritable: true },
            { pubkey: CAKE_ACCOUNT, isSigner: false, isWritable: true },
            { pubkey: productAccount, isSigner: false, isWritable: true },
            { pubkey: buyerPubkey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: historyAccount, isSigner: false, isWritable: true },
            { pubkey: buyerPubkey, isSigner: true, isWritable: true }, // payer
            { pubkey: new PublicKey('SysvarC1ock11111111111111111111111111111111'), isSigner: false, isWritable: false },
            { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
            { pubkey: ownerTokenAccount, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: USDT_MINT, isSigner: false, isWritable: false },
          ],
          data: sellData,
        })
      );

      const { blockhash, lastValidBlockHeight } = await CONNECTION.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = buyerPubkey;

      const signedTx = await walletProvider.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });

      await CONNECTION.confirmTransaction({
        signature: txId,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      setStatus(`Compra realizada! Tx: ${txId}`);
      await fetchProducts();
      await fetchPurchaseHistory();
      if (activeMenu === 'contract') {
        await fetchContractInfo();
      }
      setAmounts(prev => ({ ...prev, [productId]: '' }));
    } catch (error) {
      console.error('Erro ao processar compra:', error);
      if (error instanceof SendTransactionError) {
        const logs = await error.getLogs(CONNECTION);
        console.log('Transaction Logs:', logs);
      }
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
      setTimeout(() => setCopyMessage(''), 2000);
    } catch (error) {
      console.error('Erro ao copiar TxID:', error);
      setCopyMessage('Erro ao copiar TxID');
      setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  const abbreviateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const renderProductList = () => {
    return (
      <div>
        <h2 style={{ color: '#333', marginBottom: '10px' }}>Lista de Produtos</h2>
        {isAccountInitialized && products.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                <th style={{ padding: '12px' }}>Nome</th>
                <th style={{ padding: '12px' }}>Descrição</th>
                <th style={{ padding: '12px' }}>Preço (USDT)</th>
                <th style={{ padding: '12px' }}>Estoque</th>
                <th style={{ padding: '12px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '12px' }}>{product.name}</td>
                  <td style={{ padding: '12px' }}>{product.description}</td>
                  <td style={{ padding: '12px' }}>{(product.price / 1000000).toFixed(2)}</td>
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
          <p>Conta CAKE_ACCOUNT não está inicializada ou nenhum produto foi cadastrado.</p>
        )}
      </div>
    );
  };

  const renderPurchaseHistory = () => {
    const copyButtonStyle = {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '0 5px',
      verticalAlign: 'middle',
    };

    return (
      <div>
        <h2 style={{ color: '#333', marginBottom: '10px' }}>Histórico de Compras</h2>
        {purchaseHistory.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                <th style={{ padding: '12px' }}>Produto</th>
                <th style={{ padding: '12px' }}>Quantidade</th>
                <th style={{ padding: '12px' }}>Preço Total (USDT)</th>
                <th style={{ padding: '12px' }}>Data</th>
                <th style={{ padding: '12px' }}>Comprador</th>
                <th style={{ padding: '12px' }}>TxID</th>
              </tr>
            </thead>
            <tbody>
              {purchaseHistory.map((purchase, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '12px' }}>{purchase.productName}</td>
                  <td style={{ padding: '12px' }}>{purchase.quantity}</td>
                  <td style={{ padding: '12px' }}>{(purchase.totalPrice / 1000000).toFixed(2)}</td>
                  <td style={{ padding: '12px' }}>{purchase.date}</td>
                  <td style={{ padding: '12px', fontSize: '12px' }}>{abbreviateAddress(purchase.buyer)}</td>
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
    );
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
              onClick={() => setActiveMenu('addProduct')}
              style={{
                ...buttonStyle,
                backgroundColor: activeMenu === 'addProduct' ? '#0056b3' : '#007bff',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
              onMouseOut={(e) => (e.target.style.backgroundColor = activeMenu === 'addProduct' ? '#0056b3' : '#007bff')}
            >
              Adicionar Produto
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
            {activeMenu === 'products' && renderProductList()}
            {activeMenu === 'addProduct' && (
              <div>
                <h2 style={{ color: '#333', marginBottom: '10px' }}>Adicionar Novo Produto</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
                  <input
                    type="text"
                    placeholder="Nome do Bolo"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                  />
                  <input
                    type="text"
                    placeholder="Descrição"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                  />
                  <input
                    type="number"
                    placeholder="Preço (USDT)"
                    min="0.01"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                  />
                  <input
                    type="number"
                    placeholder="Estoque Inicial"
                    min="0"
                    value={newProduct.initialStock}
                    onChange={(e) => setNewProduct({ ...newProduct, initialStock: e.target.value })}
                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
                  />
                  <button
                    onClick={addProduct}
                    style={{ ...buttonStyle }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
                    onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
                  >
                    Adicionar Produto
                  </button>
                </div>
              </div>
            )}
            {activeMenu === 'history' && renderPurchaseHistory()}
            {activeMenu === 'contract' && showContractInfo && contractInfo && (
              <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
                <h3 style={{ color: '#333', marginBottom: '20px', fontSize: '24px', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>
                  Informações Detalhadas do Contrato Cidacake
                </h3>

                {/* Programa */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Programa</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ padding: '12px' }}>ID do Programa</td><td style={{ padding: '12px', fontFamily: 'monospace' }}>{contractInfo.programId}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Saldo (SOL)</td><td style={{ padding: '12px' }}>{contractInfo.programBalance}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Executável</td><td style={{ padding: '12px' }}>{contractInfo.programExecutable.toString()}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Conta de Estoque */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Conta de Estoque</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ padding: '12px' }}>Endereço</td><td style={{ padding: '12px', fontFamily: 'monospace' }}>{contractInfo.cakeAccount}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Saldo (SOL)</td><td style={{ padding: '12px' }}>{contractInfo.cakeAccountBalance}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Espaço (Bytes)</td><td style={{ padding: '12px' }}>{contractInfo.cakeAccountSpace}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Época de Aluguel</td><td style={{ padding: '12px' }}>{contractInfo.cakeAccountRentEpoch}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Executável</td><td style={{ padding: '12px' }}>{contractInfo.cakeAccountExecutable.toString()}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Total de Produtos</td><td style={{ padding: '12px' }}>{contractInfo.productCounter}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Total de Compras</td><td style={{ padding: '12px' }}>{contractInfo.historyCounter}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Proprietário */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Proprietário</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ padding: '12px' }}>Endereço</td><td style={{ padding: '12px', fontFamily: 'monospace' }}>{contractInfo.ownerPubkey}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Saldo (SOL)</td><td style={{ padding: '12px' }}>{contractInfo.ownerAccountBalance}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Conta de Token</td><td style={{ padding: '12px', fontFamily: 'monospace' }}>{contractInfo.ownerTokenAccount}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Saldo de USDT</td><td style={{ padding: '12px' }}>{contractInfo.ownerTokenBalance} USDT</td></tr>
                      <tr><td style={{ padding: '12px' }}>Mint do Token</td><td style={{ padding: '12px', fontFamily: 'monospace' }}>{contractInfo.ownerTokenMint}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Comprador */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Conta de Token do Comprador</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Campo</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ padding: '12px' }}>Endereço</td><td style={{ padding: '12px', fontFamily: 'monospace' }}>{contractInfo.buyerTokenAccount}</td></tr>
                      <tr><td style={{ padding: '12px' }}>Saldo de USDT</td><td style={{ padding: '12px' }}>{contractInfo.buyerTokenBalance} USDT</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Produtos */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Produtos Registrados</h4>
                  {contractInfo.products.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                          <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Nome</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Descrição</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Preço (USDT)</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Estoque</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractInfo.products.map(product => (
                          <tr key={product.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '12px' }}>{product.id}</td>
                            <td style={{ padding: '12px' }}>{product.name}</td>
                            <td style={{ padding: '12px' }}>{product.description}</td>
                            <td style={{ padding: '12px' }}>{product.price.toFixed(2)}</td>
                            <td style={{ padding: '12px' }}>{product.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>Nenhum produto registrado.</p>
                  )}
                </div>

                {/* Última Compra */}
                {contractInfo.lastPurchase && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#007bff', fontSize: '18px', marginBottom: '10px' }}>Última Compra</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '5px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Campo</th>
                          <th style={{ padding: '12px', textAlign: 'left' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td style={{ padding: '12px' }}>Produto</td><td style={{ padding: '12px' }}>{contractInfo.lastPurchase.productName}</td></tr>
                        <tr><td style={{ padding: '12px' }}>Quantidade</td><td style={{ padding: '12px' }}>{contractInfo.lastPurchase.quantity}</td></tr>
                        <tr><td style={{ padding: '12px' }}>Preço Total (USDT)</td><td style={{ padding: '12px' }}>{contractInfo.lastPurchase.totalPrice}</td></tr>
                        <tr><td style={{ padding: '12px' }}>Comprador</td><td style={{ padding: '12px', fontFamily: 'monospace' }}>{abbreviateAddress(contractInfo.lastPurchase.buyer)}</td></tr>
                        <tr><td style={{ padding: '12px' }}>Data</td><td style={{ padding: '12px' }}>{contractInfo.lastPurchase.timestamp}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}

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