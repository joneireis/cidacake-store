const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { createMetadataAccountV3, mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
const { keypairIdentity, publicKey, createSignerFromKeypair } = require('@metaplex-foundation/umi');
const { fromWeb3JsKeypair, toWeb3JsPublicKey } = require('@metaplex-foundation/umi-web3js-adapters');
const { Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

async function addTokenMetadata() {
    try {
        console.log('Iniciando o processo de adição de metadados...');

        // Criar uma instância do Umi
        const umi = createUmi('https://api.devnet.solana.com');
        console.log('Umi criado:', umi.rpc.getEndpoint());

        // Carregar a chave privada do owner
        const ownerKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/owner-wallet.json', 'utf-8')))
        );
        console.log('Owner Keypair (web3.js):', ownerKeypair.publicKey.toString());

        // Converter o keypair para o formato Umi
        const umiKeypair = fromWeb3JsKeypair(ownerKeypair);
        console.log('Umi Keypair convertido:', umiKeypair.publicKey.toString());

        umi.use(keypairIdentity(umiKeypair));
        console.log('Identidade Umi configurada:', umi.identity.publicKey.toString());

        // Usar o plugin mplTokenMetadata
        umi.use(mplTokenMetadata());
        console.log('Plugin mplTokenMetadata carregado.');

        const mint = publicKey('9V3992f9PJup6T1AGiXeBNzp2VE7zDjXkJj7Df4g9vxr');
        console.log('Mint Address (Umi):', mint.toString());

        const tokenMetadataProgramId = publicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
        console.log('Token Metadata Program ID (Umi):', tokenMetadataProgramId.toString());

        // Calcular o endereço PDA dos metadados
        const metadataPDA = umi.eddsa.findPda(tokenMetadataProgramId, [
            Buffer.from('metadata'),
            toWeb3JsPublicKey(tokenMetadataProgramId).toBuffer(),
            toWeb3JsPublicKey(mint).toBuffer(),
        ]);
        console.log('Metadata PDA (Umi):', metadataPDA.toString());

        // Dados dos metadados
        const metadataData = {
            name: 'USDT',
            symbol: 'USDT',
            uri: 'https://example.com/usdt-metadata.json',
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            collectionDetails: null,
            uses: null,
        };
        console.log('Metadata Data:', JSON.stringify(metadataData, null, 2));

        // Criar a transação para adicionar os metadados
        console.log('Criando transação para adicionar metadados...');
        const transactionBuilder = createMetadataAccountV3(umi, {
            metadata: metadataPDA,
            mint: mint,
            mintAuthority: umi.identity,
            payer: umi.identity,
            updateAuthority: umi.identity.publicKey,
            data: metadataData,
            isMutable: true,
            collectionDetails: null,
        });

        console.log('Transação criada:', transactionBuilder);

        console.log('Enviando e confirmando transação...');
        const { signature } = await transactionBuilder.sendAndConfirm(umi);
        console.log('Transação enviada e confirmada. Signature:', Buffer.from(signature).toString('base64'));

        console.log('Metadados adicionados com sucesso! Signature:', Buffer.from(signature).toString('base64'));
    } catch (err) {
        console.error('Erro:', err);
        console.error('Stack Trace:', err.stack);
    }
}

addTokenMetadata();