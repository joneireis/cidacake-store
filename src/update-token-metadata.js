const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { updateMetadataAccountV2, mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
const { keypairIdentity, publicKey } = require('@metaplex-foundation/umi');
const { fromWeb3JsKeypair, toWeb3JsPublicKey } = require('@metaplex-foundation/umi-web3js-adapters');
const { Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

async function updateTokenMetadata() {
    try {
        console.log('Iniciando o processo de atualização de metadados...');

        const umi = createUmi('https://api.devnet.solana.com');
        console.log('Umi criado:', umi.rpc.getEndpoint());

        const ownerKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync('/home/ubuntu/solanavm/dev/owner-wallet.json', 'utf-8')))
        );
        console.log('Owner Keypair (web3.js):', ownerKeypair.publicKey.toString());

        const umiKeypair = fromWeb3JsKeypair(ownerKeypair);
        umi.use(keypairIdentity(umiKeypair));
        console.log('Owner Keypair (Umi):', umiKeypair.publicKey.toString());

        umi.use(mplTokenMetadata());
        console.log('Plugin mplTokenMetadata carregado.');

        const mint = publicKey('9V3992f9PJup6T1AGiXeBNzp2VE7zDjXkJj7Df4g9vxr');
        console.log('Mint Address (Umi):', mint.toString());

        const tokenMetadataProgramId = publicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
        console.log('Token Metadata Program ID (Umi):', tokenMetadataProgramId.toString());

        const metadataPDA = umi.eddsa.findPda(tokenMetadataProgramId, [
            Buffer.from('metadata'),
            toWeb3JsPublicKey(tokenMetadataProgramId).toBuffer(),
            toWeb3JsPublicKey(mint).toBuffer(),
        ]);
        console.log('Metadata PDA (Umi):', metadataPDA.toString());

        const metadataData = {
            name: 'USDT',
            symbol: 'USDT',
            uri: 'https://arweave.net/<hash>', // Substitua pelo URI real
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            collectionDetails: null,
            uses: null,
        };
        console.log('Metadata Data:', JSON.stringify(metadataData, null, 2));

        console.log('Atualizando metadados...');
        const transactionBuilder = updateMetadataAccountV2(umi, {
            metadata: metadataPDA,
            updateAuthority: umi.identity,
            data: metadataData,
        });

        console.log('Transação criada:', transactionBuilder);

        console.log('Enviando e confirmando transação...');
        const { signature } = await transactionBuilder.sendAndConfirm(umi);
        console.log('Transação enviada e confirmada. Signature:', Buffer.from(signature).toString('base64'));

        console.log('Metadados atualizados com sucesso! Signature:', Buffer.from(signature).toString('base64'));
    } catch (err) {
        console.error('Erro:', err);
        console.error('Stack Trace:', err.stack);
    }
}

updateTokenMetadata();