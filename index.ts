import { SSVSDK } from '@ssv-labs/ssv-sdk'
import { createPublicClient, createWalletClient, http } from 'viem'
import { hoodi } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { readdir } from 'node:fs/promises'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const subgraphEndpoint = process.env.SUBGRAPH_ENDPOINT;
const subgraphApiKey = process.env.SUBGRAPH_API_KEY;
const keystoreDir = process.env.KEYSTORE_DIR
const keystorePass = process.env.KEYSTORE_PASS
const ownerAddress = process.env.OWNER_ADDRESS

async function loadKeystores(): Promise<string[]> {

  try{
    const files = await readdir(keystoreDir)
    const keystores: string[] = []
    for (const file of files) {
        const content = await Bun.file(file).text();
        const data = JSON.stringify(content);
      keystores.push(data)
    }
    return keystores;
  } catch (error) {
    console.error("Failed to read keystore.json:", error);
    throw new Error("Failed to load keystore. Please check keystore.json exists and is valid.");
  }
}

async function main() {
  // Setup viem clients
  const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
  const keystores = await loadKeystores()

  const transport = http();
  const publicClient = createPublicClient({
    chain: hoodi,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: hoodi,
    transport,
  });

  // Initialize SDK with viem clients
  const sdk = new SSVSDK({
    publicClient: publicClient as any,
    walletClient: walletClient as any,
    extendedConfig: {
      subgraph: {
        apiKey: subgraphApiKey,
        endpoint: subgraphEndpoint,
      }
    }
  });
  
  
  let nonce = Number(await sdk.api.getOwnerNonce({ owner: ownerAddress}))
  let operatorIds = ["1","2","3","4"]
  let operators = await sdk.api.getOperators({operatorIds})

  const keysharesPayload = await sdk.utils.generateKeyShares({
    keystore: keystores,
    keystore_password: keystorePass,
    operator_keys: operators.map((operator) => operator.publicKey),
    operator_ids: operators.map((operator) => parseInt(operator.id)),
    owner_address: ownerAddress as string,
    nonce: nonce,
  })

  const txnReceipt = await sdk.clusters.registerValidators({
    args: {
      keyshares: keysharesPayload,
      depositAmount: 100000n, // Placeholder - actual deposit amount should be set based on requirements
    },
  }).then(tx => tx.wait());

  console.log(txnReceipt.transactionHash)
}

main();