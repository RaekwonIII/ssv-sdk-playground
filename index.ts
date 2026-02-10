import { SSVSDK } from '@ssv-labs/ssv-sdk'
import { createPublicClient, createWalletClient, http } from 'viem'
import { hoodi } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { readdir } from 'node:fs/promises'

const KEYSTORE_DIR = "../dev/ethstaker_deposit-cli-b13dcb9-linux-amd64/validator_keys/keystore-m_12381_3600_0_0_0-1770287966.json"

// Setup viem clients
const privateKey = process.env.PRIVATE_KEY as `0x${string}`
// const chain = chains.hoodi;
const subgraphEndpoint = process.env.SUBGRAPH_ENDPOINT;
const subgraphApiKey = process.env.SUBGRAPH_API_KEY;

async function loadKeystores(): Promise<string[]> {

  try{
    const files = await readdir(KEYSTORE_DIR)
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
  
  const ownerAddress = "0xaA184b86B4cdb747F4A3BF6e6FCd5e27c1d92c5c"
  let nonce = Number(await sdk.api.getOwnerNonce({ owner: ownerAddress}))
  let operatorIds = ["1","2","3","4"]
  let operators = await sdk.api.getOperators({operatorIds})

  const keysharesPayload = await sdk.utils.generateKeyShares({
    keystore: keystores,
    keystore_password: '#Il1k3turtlez' ,
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