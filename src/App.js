import React, { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, SystemProgram, TransactionInstruction, Transaction, LAMPORTS_PER_SOL, SendTransactionError } from '@solana/web3.js';
import { getAccount, getTokenAccountsByOwner } from '@solana/spl-token';
import { Buffer } from 'buffer';
import './App.css';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-hot-toast';

window.Buffer = Buffer;

const PROGRAM_ID = new PublicKey('42xArAzDPAKWxz8jg4Y3V5NkYj4YUpupNCoFKW5of6D5');
const CONNECTION = new Connection('https://api.devnet.solana.com', 'confirmed');
const OWNER_PUBKEY = new PublicKey('yG9KfVSMZaMZHSY48KKxpvtdPZhbAMUsYsAfKZDUkW5');
const CAKE_ACCOUNT = new PublicKey('HUBWyjMiwAsdctup35Fkj9vdpbukNadpauPvKCaR5ADb');
const OWNER_TOKEN_ACCOUNT = new PublicKey('AP1B1X3QYVo54LDreFgeAxhCULhqrQw89tffiDHBGKhf');
const USDT_MINT = new PublicKey('9V3992f9PJup6T1AGiXeBNzp2VE7zDjXkJj7Df4g9vxr');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const PurchaseHistory = {
  LEN: 65, // Atualizado para u64 no product_id
  unpack_from_slice(src) {
    if (src.length !== this.LEN) {
      throw new Error('Dados inválidos para PurchaseHistory: tamanho incorreto');
    }
    const product_id = Number(src.readBigUInt64LE(0));
    const quantity = Number(src.readBigUInt64LE(8));
    const total_price = Number(src.readBigUInt64LE(16));
    const buyer = new PublicKey(src.slice(24, 56));
    const timestamp = Number(src.readBigInt64LE(56));
    return { product_id, quantity, total_price, buyer, timestamp };
  },
};

const Notification = ({ message, type, onClose }) => (
  <div className={`notification ${type}`}>
    <p>{message}</p>
    <button onClick={onClose} className="close-btn">×</button>
  </div>
);

const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
  </div>
);

const ProductCard = ({ product, onBuy, amounts, onAmountChange }) => (
  <div className="product-card">
    <div className="product-header">
      <h3>{product.name}</h3>
      <span className={`stock-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
        {product.stock} em estoque
      </span>
    </div>
    <p className="product-description">{product.description}</p>
    <div className="product-footer">
      <span className="price-tag">{(product.price / 10 ** 6).toFixed(2)} USDT</span>
      <div className="buy-controls">
        <input
          type="number"
          min="1"
          max={product.stock}
          value={amounts[product.id] || ''}
          onChange={(e) => onAmountChange(product.id, e.target.value)}
          placeholder="Quantidade"
          className="quantity-input"
        />
        <button
          onClick={() => onBuy(product.id)}
          disabled={!amounts[product.id] || parseInt(amounts[product.id]) <= 0 || parseInt(amounts[product.id]) > product.stock}
          className="buy-button"
        >
          Comprar
        </button>
      </div>
    </div>
  </div>
);

const PurchaseHistoryTable = ({ history, onCopyTxId, copyMessage }) => (
  <div className="purchase-history">
    <h2>Histórico de Compras</h2>
    {history.length > 0 ? (
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Preço Total (USDT)</th>
            <th>Data</th>
            <th>Comprador</th>
            <th>TxID</th>
          </tr>
        </thead>
        <tbody>
          {history.map((purchase, index) => (
            <tr key={index}>
              <td>{purchase.productName}</td>
              <td>{purchase.quantity}</td>
              <td>{(purchase.totalPrice / 10 ** 6).toFixed(2)}</td>
              <td>{purchase.date}</td>
              <td>{abbreviateAddress(purchase.buyer)}</td>
              <td>
                {purchase.txId.slice(0, 10)}...
                <button
                  onClick={() => onCopyTxId(purchase.txId)}
                  className="copy-button"
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
      <p className="no-history">Nenhuma compra registrada ainda.</p>
    )}
    {copyMessage && <p className="copy-message">{copyMessage}</p>}
  </div>
);

// Função para abreviar endereços Solana
const abbreviateAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// Função para mostrar notificações
const showNotification = (message, type) => {
  toast(message, {
    duration: 4000,
    position: 'top-right',
    style: {
      background: type === 'error' ? '#ff4444' : '#00C851',
      color: '#fff',
      padding: '16px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
  });
};

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', initialStock: '' });
  const [status, setStatus] = useState('');
  const [walletProvider, setWalletProvider] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [showContractInfo, setShowContractInfo] = useState(false);
  const [activeMenu, setActiveMenu] = useState('products');
  const [products, setProducts] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [isAccountInitialized, setIsAccountInitialized] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const connectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      let provider = window.solana;
      if (!provider || !provider.isPhantom) {
        showNotification('Por favor, instale a carteira Phantom!', 'error');
        return;
      }
      await provider.connect({ onlyIfTrusted: false });
      const pubkey = provider.publicKey.toString();
      setWalletAddress(pubkey);
      setWalletProvider(provider);
      showNotification(`Carteira conectada: ${abbreviateAddress(pubkey)}`, 'success');
      await checkAccountStatus();
      await fetchPurchaseHistory();
    } catch (error) {
      console.error('Erro ao conectar à carteira:', error);
      showNotification(`Erro: Não foi possível conectar a carteira. ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

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

  const disconnectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      if (window.solana) {
        await window.solana.disconnect();
      }
      setWalletAddress(null);
      setWalletProvider(null);
      setContractInfo(null);
      setShowContractInfo(false);
      setActiveMenu('products');
      setProducts([]);
      setPurchaseHistory([]);
      setIsAccountInitialized(false);
      showNotification('Carteira desconectada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao desconectar carteira:', error);
      showNotification(`Erro: Não foi possível desconectar a carteira. ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

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
      setStatus(`Erro: Não foi possível verificar o status da conta. ${error.message}`);
      setIsAccountInitialized(false);
    }
  };

  useEffect(() => {
    if (isAccountInitialized) {
      fetchProducts();
    }
  }, [isAccountInitialized]);

  const fetchPurchaseHistory = async (page = 1, perPage = 10) => {
    try {
      setIsLoading(true);
      setStatus('Carregando histórico de compras...');
      const offset = (page - 1) * perPage;
      const programAccounts = await CONNECTION.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: PurchaseHistory.LEN }],
      });

      if (!programAccounts || programAccounts.length === 0) {
        setPurchaseHistory([]);
        setStatus('Nenhuma compra encontrada na blockchain.');
        return;
      }

      const history = programAccounts.map(account => {
        const data = account.account.data;
        const purchase = PurchaseHistory.unpack_from_slice(data);
        const product = products.find(p => p.id === purchase.product_id) || { name: `Produto ${purchase.product_id}` };
        return {
          txId: account.pubkey.toString(),
          productName: product.name,
          quantity: purchase.quantity.toString(),
          totalPrice: purchase.total_price.toString(),
          date: new Date(purchase.timestamp * 1000).toLocaleString(),
          buyer: purchase.buyer.toString(),
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(offset, offset + perPage);

      setPurchaseHistory(history);
      setStatus(`Histórico de compras carregado: ${history.length} de ${programAccounts.length} exibidos.`);
    } catch (error) {
      console.error('Erro ao buscar histórico de compras:', error);
      setStatus(`Erro: Não foi possível carregar o histórico de compras. ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addProduct = async () => {
    if (!walletProvider || !walletAddress) {
      setStatus('Conecte a carteira antes de continuar!');
      return;
    }
    if (walletAddress !== OWNER_PUBKEY.toString()) {
      setStatus('Apenas o proprietário pode adicionar produtos!');
      return;
    }

    const { name, description, price, initialStock } = newProduct;
    if (!name || !description || !price || !initialStock || parseFloat(price) <= 0 || parseInt(initialStock) < 0) {
      setStatus('Preencha todos os campos corretamente!');
      return;
    }
    if (name.length > 32 || description.length > 128) {
      setStatus('Nome (máx 32 caracteres) ou descrição (máx 128 caracteres) muito longos!');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Adicionando novo produto...');
      const transaction = new Transaction();

      const productId = (await fetchProductCounter()) || 0;
      const [productAccount, bump] = await PublicKey.findProgramAddress(
        [Buffer.from('product'), Buffer.from(new BigUint64Array([BigInt(productId)]).buffer)],
        PROGRAM_ID
      );

      const addProductData = new Uint8Array(177);
      addProductData[0] = 1;
      const nameBytes = new TextEncoder().encode(name.padEnd(32, '\0').slice(0, 32));
      const descriptionBytes = new TextEncoder().encode(description.padEnd(128, '\0').slice(0, 128));
      const priceInLamports = BigInt(Math.round(parseFloat(price) * 10 ** 6));
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

      const signedTx = await walletProvider.signTransaction(transaction);
      const txId = await CONNECTION.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });

      await CONNECTION.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight }, 'confirmed');
      setStatus(`Produto adicionado com sucesso! Tx: ${txId}`);
      setNewProduct({ name: '', description: '', price: '', initialStock: '' });
      await fetchProducts();
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      setStatus(`Erro: Não foi possível adicionar o produto. ${error.message}`);
    } finally {
      setIsLoading(false);
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

  const fetchProductsData = async () => {
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
    return fetchedProducts;
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setStatus('Consultando produtos...');
      const fetchedProducts = await fetchProductsData();
      setProducts(fetchedProducts);
      setStatus(`Produtos carregados: ${fetchedProducts.length} bolos encontrados.`);
    } catch (error) {
      console.error('Erro ao consultar produtos:', error);
      setStatus(`Erro: Não foi possível consultar os produtos. ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContractInfo = async () => {
    try {
      setIsLoading(true);
      setStatus('Obtendo informações detalhadas do contrato...');

      const cakeAccountInfo = await CONNECTION.getAccountInfo(CAKE_ACCOUNT);
      if (!cakeAccountInfo) throw new Error('CAKE_ACCOUNT não encontrada.');
      const cakeAccountBalance = (cakeAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4);
      const cakeAccountSpace = cakeAccountInfo.space;
      const cakeAccountRentEpoch = cakeAccountInfo.rentEpoch;
      const cakeAccountExecutable = cakeAccountInfo.executable;
      const productCounter = Number(cakeAccountInfo.data.readBigUInt64LE(32));
      const historyCounter = Number(cakeAccountInfo.data.readBigUInt64LE(40));

      const ownerAccountInfo = await CONNECTION.getAccountInfo(OWNER_PUBKEY);
      const ownerAccountBalance = ownerAccountInfo ? (ownerAccountInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';

      const ownerTokenAccountInfo = await getAccount(CONNECTION, OWNER_TOKEN_ACCOUNT);
      const ownerTokenBalance = Number(ownerTokenAccountInfo.amount) / 10 ** 6;
      const ownerTokenMint = ownerTokenAccountInfo.mint.toString();

      const buyerTokenAccount = new PublicKey('5PmmgsYepReKZorTWXQMK6BoE9DbX6TXvcSgx3kUVCVP');
      const buyerTokenAccountInfo = await getAccount(CONNECTION, buyerTokenAccount);
      const buyerTokenBalance = Number(buyerTokenAccountInfo.amount) / 10 ** 6;

      const programInfo = await CONNECTION.getAccountInfo(PROGRAM_ID);
      const programBalance = programInfo ? (programInfo.lamports / LAMPORTS_PER_SOL).toFixed(4) : 'N/A';
      const programExecutable = programInfo ? programInfo.executable : 'N/A';

      const productsList = await fetchProductsData();

      let lastPurchase = null;
      if (historyCounter > 0) {
        const programAccounts = await CONNECTION.getProgramAccounts(PROGRAM_ID, {
          filters: [{ dataSize: PurchaseHistory.LEN }],
        });
        if (programAccounts.length > 0) {
          const latestAccount = programAccounts.sort((a, b) => {
            const aTimestamp = Number(a.account.data.readBigInt64LE(56));
            const bTimestamp = Number(b.account.data.readBigInt64LE(56));
            return bTimestamp - aTimestamp;
          })[0];
          const purchase = PurchaseHistory.unpack_from_slice(latestAccount.account.data);
          const product = productsList.find(p => p.id === purchase.product_id) || { name: `Produto ${purchase.product_id}` };
          lastPurchase = {
            productName: product.name,
            quantity: purchase.quantity,
            totalPrice: (purchase.total_price / 10 ** 6).toFixed(2),
            buyer: purchase.buyer.toString(),
            timestamp: new Date(purchase.timestamp * 1000).toLocaleString(),
          };
        }
      }

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
      setStatus(`Erro: Não foi possível obter informações do contrato. ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const buyCidacake = async (productId) => {
    if (!walletProvider || !walletAddress) {
      setStatus('Conecte a carteira antes de continuar!');
      return;
    }

    const amount = amounts[productId] || '';
    if (!amount || parseInt(amount) <= 0) {
      setStatus('Insira uma quantidade válida para o produto selecionado!');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Processando compra...');
      const wallet = walletProvider;
      if (!wallet.isConnected) {
        throw new Error('Carteira não está conectada!');
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
      const [historyAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from('history'),
          Buffer.from(buyerPubkey.toBytes()),
          Buffer.from(new BigUint64Array([BigInt(productId)]).buffer),
          Buffer.from(new BigUint64Array([BigInt(historyIndex)]).buffer),
        ],
        PROGRAM_ID
      );

      const tokenAccounts = await CONNECTION.getTokenAccountsByOwner(buyerPubkey, { mint: USDT_MINT });
      const buyerTokenAccount = tokenAccounts.value[0]?.pubkey;
      if (!buyerTokenAccount) {
        throw new Error('Conta USDT não encontrada para o comprador.');
      }
      const ownerTokenAccount = OWNER_TOKEN_ACCOUNT;

      const sellData = new Uint8Array(17);
      sellData[0] = 4;
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
            { pubkey: buyerPubkey, isSigner: true, isWritable: true },
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

      await CONNECTION.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight }, 'confirmed');
      setStatus(`Compra realizada com sucesso! Tx: ${txId}`);
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
        setStatus(`Erro: Falha na transação. Verifique o saldo ou estoque. ${error.message}`);
      } else {
        setStatus(`Erro: Não foi possível processar a compra. ${error.message}`);
      }
    } finally {
      setIsLoading(false);
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

  const renderLoginScreen = () => (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="welcome-title">Bem-vindo ao CidaCake Store</h1>
        <p className="welcome-subtitle">Conecte sua carteira para começar</p>
        <button onClick={connectWallet} className="connect-button">
          <span className="button-icon">🔗</span>
          Conectar com Phantom Wallet
        </button>
      </div>
    </div>
  );

  const renderProductList = () => (
    <div className="product-list">
      <div className="product-list-header">
        <h2>Nossos Produtos</h2>
        {walletAddress === OWNER_PUBKEY.toString() && (
          <button
            onClick={() => setActiveMenu('addProduct')}
            className="add-product-button"
          >
            <span className="button-icon">+</span>
            Adicionar Produto
          </button>
        )}
      </div>
      
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onBuy={buyCidacake}
            amounts={amounts}
            onAmountChange={handleAmountChange}
          />
        ))}
      </div>
    </div>
  );

  const renderAddProductForm = () => (
    <div className="add-product-form">
      <h2>Adicionar Novo Produto</h2>
      <div className="form-grid">
        <input
          type="text"
          placeholder="Nome do Produto"
          value={newProduct.name}
          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
          className="form-input"
        />
        <textarea
          placeholder="Descrição"
          value={newProduct.description}
          onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
          className="form-input"
        />
        <input
          type="number"
          placeholder="Preço"
          value={newProduct.price}
          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
          className="form-input"
        />
        <input
          type="number"
          placeholder="Estoque Inicial"
          value={newProduct.initialStock}
          onChange={(e) => setNewProduct({ ...newProduct, initialStock: e.target.value })}
          className="form-input"
        />
        <button
          onClick={addProduct}
          className="submit-button"
        >
          Adicionar Produto
        </button>
      </div>
    </div>
  );

  const renderContractInfo = () => (
    <div className="contract-info">
      <h2>Informações do Contrato</h2>
      {contractInfo && (
        <div className="info-grid">
          <div className="info-section">
            <h3>Contas Principais</h3>
            <p><strong>Program ID:</strong> {abbreviateAddress(contractInfo.programId)}</p>
            <p><strong>Conta CAKE:</strong> {abbreviateAddress(contractInfo.cakeAccount)}</p>
            <p><strong>Proprietário:</strong> {abbreviateAddress(contractInfo.ownerPubkey)}</p>
            <p><strong>Conta Token Proprietário:</strong> {abbreviateAddress(contractInfo.ownerTokenAccount)}</p>
            <p><strong>Conta Token Comprador:</strong> {abbreviateAddress(contractInfo.buyerTokenAccount)}</p>
          </div>

          <div className="info-section">
            <h3>Saldo das Contas</h3>
            <p><strong>Saldo CAKE Account:</strong> {contractInfo.cakeAccountBalance} SOL</p>
            <p><strong>Saldo Proprietário:</strong> {contractInfo.ownerAccountBalance} SOL</p>
            <p><strong>Saldo Token Proprietário:</strong> {contractInfo.ownerTokenBalance} USDT</p>
            <p><strong>Saldo Token Comprador:</strong> {contractInfo.buyerTokenBalance} USDT</p>
            <p><strong>Saldo Programa:</strong> {contractInfo.programBalance} SOL</p>
          </div>

          <div className="info-section">
            <h3>Informações da Conta CAKE</h3>
            <p><strong>Espaço:</strong> {contractInfo.cakeAccountSpace} bytes</p>
            <p><strong>Rent Epoch:</strong> {contractInfo.cakeAccountRentEpoch}</p>
            <p><strong>Executável:</strong> {contractInfo.cakeAccountExecutable ? 'Sim' : 'Não'}</p>
            <p><strong>Contador de Produtos:</strong> {contractInfo.productCounter}</p>
            <p><strong>Contador de Histórico:</strong> {contractInfo.historyCounter}</p>
          </div>

          {contractInfo.lastPurchase && (
            <div className="info-section">
              <h3>Última Compra</h3>
              <p><strong>Produto:</strong> {contractInfo.lastPurchase.productName}</p>
              <p><strong>Quantidade:</strong> {contractInfo.lastPurchase.quantity}</p>
              <p><strong>Preço Total:</strong> {contractInfo.lastPurchase.totalPrice} USDT</p>
              <p><strong>Comprador:</strong> {abbreviateAddress(contractInfo.lastPurchase.buyer)}</p>
              <p><strong>Data:</strong> {contractInfo.lastPurchase.timestamp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container">
      {notification.message && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ message: '', type: '' })}
        />
      )}

      {isLoading && <LoadingSpinner />}

      {!walletAddress ? (
        renderLoginScreen()
      ) : (
        <>
          <header className="app-header">
            <div className="header-content">
              <h1 className="app-title">CidaCake Store</h1>
              <div className="wallet-info">
                <span className="wallet-address">
                  {abbreviateAddress(walletAddress)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="disconnect-button"
                >
                  Desconectar
                </button>
              </div>
            </div>
          </header>

          <main className="app-main">
            <nav className="main-nav">
              <button
                onClick={() => setActiveMenu('products')}
                className={`nav-button ${activeMenu === 'products' ? 'active' : ''}`}
              >
                Produtos
              </button>
              <button
                onClick={() => setActiveMenu('history')}
                className={`nav-button ${activeMenu === 'history' ? 'active' : ''}`}
              >
                Histórico
              </button>
              {walletAddress === OWNER_PUBKEY.toString() && (
                <button
                  onClick={() => setActiveMenu('addProduct')}
                  className={`nav-button ${activeMenu === 'addProduct' ? 'active' : ''}`}
                >
                  Adicionar Produto
                </button>
              )}
              <button
                onClick={() => {
                  setActiveMenu('contract');
                  fetchContractInfo();
                }}
                className={`nav-button ${activeMenu === 'contract' ? 'active' : ''}`}
              >
                Informações do Contrato
              </button>
            </nav>

            <div className="main-content">
              {activeMenu === 'products' && renderProductList()}
              {activeMenu === 'history' && (
                <PurchaseHistoryTable
                  history={purchaseHistory}
                  onCopyTxId={copyTxId}
                  copyMessage={copyMessage}
                />
              )}
              {activeMenu === 'addProduct' && renderAddProductForm()}
              {activeMenu === 'contract' && renderContractInfo()}
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default App;