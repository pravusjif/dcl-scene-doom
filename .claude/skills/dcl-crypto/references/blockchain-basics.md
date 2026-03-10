# Blockchain Basics for Decentraland SDK7

## executeTask Usage and Patterns

All blockchain operations are asynchronous and must be wrapped in `executeTask`. This function is provided by the SDK runtime and ensures async operations run correctly within the scene lifecycle.

```typescript
import { executeTask } from '@dcl/sdk/ecs'

// Basic pattern
executeTask(async () => {
  // All async blockchain operations go here
})

// With error handling (recommended)
executeTask(async () => {
  try {
    // Blockchain operations
  } catch (error) {
    console.error('Operation failed:', error)
  }
})

// Named function variant
executeTask(async function checkBlockchain() {
  // Operations here
})
```

### Why executeTask Is Required

Decentraland scenes run in a synchronous game loop. `executeTask` creates an async context that the runtime manages, ensuring blockchain calls (which involve network requests and wallet prompts) do not block the scene.

## Player Identity and Wallet Info

### getUserData / getPlayer

```typescript
import { getPlayer } from '@dcl/sdk/src/players'

function checkWallet() {
  const player = getPlayer()
  if (player && !player.isGuest) {
    console.log('Player wallet address:', player.userId)
  } else {
    console.log('Player is guest (no wallet)')
  }
}
```

Key fields:
- `player.userId` — the player's Ethereum wallet address (when connected)
- `player.isGuest` — `true` if the player has no wallet connected

Always check `isGuest` before any blockchain operation. Guest players cannot sign transactions, and all crypto calls will fail for them.

## Ethereum Provider and Contract Interaction

### Creating a Provider

The Ethereum provider bridges the scene to the player's wallet (MetaMask or equivalent).

```typescript
import { RequestManager, ContractFactory } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'

executeTask(async () => {
  // Create the web3 provider interface
  const provider = createEthereumProvider()

  // Create request manager for sending/receiving RPC messages
  const requestManager = new RequestManager(provider)
})
```

### Checking Gas Price

```typescript
import { RequestManager } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'

executeTask(async function () {
  const provider = createEthereumProvider()
  const requestManager = new RequestManager(provider)

  // Check current gas price on the Ethereum network
  const gasPrice = await requestManager.eth_gasPrice()
  console.log({ gasPrice })
})
```

### Checking ETH Balance

```typescript
executeTask(async () => {
  const provider = createEthereumProvider()
  const requestManager = new RequestManager(provider)

  const balance = await requestManager.eth_getBalance('0x123...abc', 'latest')
  console.log('Account balance:', balance)
})
```

## Smart Contract Interaction

### ABI Format

Store contract ABIs in separate files (e.g., `src/contracts/mana.ts`):

```typescript
// Example of one function in the MANA ABI
export const abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'burner',
        type: 'address'
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256'
      }
    ],
    name: 'Burn',
    type: 'event'
  }
  // ... rest of ABI
]
```

### Instancing a Contract

```typescript
import { RequestManager, ContractFactory } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'
import { abi } from '../contracts/mana'

executeTask(async () => {
  const provider = createEthereumProvider()
  const requestManager = new RequestManager(provider)

  // Create a factory based on the ABI
  const factory = new ContractFactory(requestManager, abi)

  // Instance the contract at a specific address
  const contract = (await factory.at(
    '0x2a8fd99c19271f4f04b1b7b9c4f7cf264b626edb'
  )) as any
})
```

### Calling Contract Methods

```typescript
import { getPlayer } from '@dcl/sdk/src/players'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'
import { RequestManager, ContractFactory } from 'eth-connect'
import { abi } from '../contracts/mana'

executeTask(async () => {
  try {
    const provider = createEthereumProvider()
    const requestManager = new RequestManager(provider)
    const factory = new ContractFactory(requestManager, abi)
    const contract = (await factory.at(
      '0x2a8fd99c19271f4f04b1b7b9c4f7cf264b626edb'
    )) as any

    let userData = getPlayer()
    if (userData.isGuest) {
      return
    }

    // Write operation (costs gas, prompts wallet)
    const res = await contract.setBalance(
      '0xaFA48Fad27C7cAB28dC6E970E4BFda7F7c8D60Fb',
      100,
      {
        from: userData.userId,
      }
    )
    console.log(res)
  } catch (error: any) {
    console.log(error.toString())
  }
})
```

### Read vs Write Operations

```typescript
executeTask(async () => {
  try {
    const userData = getPlayer()
    if (userData.isGuest) return

    // Read operation — free, no gas, no wallet prompt
    const balance = await contract.balanceOf(userData.userId)
    console.log('Current balance:', balance)

    // Write operation — costs gas, prompts wallet confirmation
    const writeResult = await contract.transfer(
      '0xRecipientAddress',
      100,
      {
        from: userData.userId,
        gas: 100000,
        gasPrice: await requestManager.eth_gasPrice()
      }
    )
    console.log('Transaction hash:', writeResult)
  } catch (error) {
    console.log('Transaction failed:', error)
  }
})
```

### Send Custom RPC Messages

```typescript
import { sendAsync } from '~system/EthereumController'

await sendAsync({
  id: 1,
  method: 'myMethod',
  jsonParams: '{ myParam: myValue }',
})
```

## signedFetch

`signedFetch` makes HTTP requests that include the player's identity and a cryptographic signature in the headers. This allows your backend server to verify the request genuinely came from the player who claims to be making it.

### Basic GET Request

```typescript
import { executeTask } from '@dcl/sdk/ecs'
import { signedFetch } from '@dcl/sdk/network'

executeTask(async () => {
  try {
    const response = await signedFetch('https://api.example.com/data')
    const json = await response.json()
    console.log('Response:', json)
  } catch (error) {
    console.error('Failed to fetch:', error)
  }
})
```

### POST Request with Body

```typescript
executeTask(async () => {
  try {
    const response = await signedFetch('https://api.example.com/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'value'
      })
    })
    const json = await response.json()
    console.log('Response:', json)
  } catch (error) {
    console.error('Failed to fetch:', error)
  }
})
```

### Authenticated Action (Claim Reward Example)

```typescript
import { signedFetch } from '@dcl/sdk/signed-fetch'

executeTask(async () => {
  try {
    const response = await signedFetch('https://example.com/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'claimReward',
        amount: 100
      })
    })

    const result = await response.json()
    console.log('Transaction result:', result)
  } catch (error) {
    console.log('Transaction failed:', error)
  }
})
```

## Using Test Networks

```typescript
// For Sepolia testnet testing
// Set Metamask to Sepolia network
// Use test URLs for preview:
// decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true&dclenv=zone&position=0,0

// Contract addresses differ between networks
const CONTRACT_ADDRESSES = {
  mainnet: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
  sepolia: '0x...' // Test contract address
}

const currentNetwork = 'sepolia' // or determine dynamically
const contractAddress = CONTRACT_ADDRESSES[currentNetwork]
```

## NFT Display with NftShape

Display certified NFTs as framed pictures in your scene:

```typescript
import { NftShape, NftFrameType } from '@dcl/sdk/ecs'

NftShape.create(entity, {
  urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558536',
  color: Color4.White(),
  style: NftFrameType.NFT_CLASSIC
})

// Available frame styles:
// NFT_CLASSIC, NFT_BAROQUE_ORNAMENT, NFT_DIAMOND_ORNAMENT,
// NFT_MINIMAL_WIDE, NFT_MINIMAL_GREY, NFT_BLOCKY,
// NFT_GOLD_EDGES, NFT_GOLD_CARVED, NFT_GOLD_WIDE, NFT_GOLD_ROUNDED,
// NFT_METAL_MEDIUM, NFT_METAL_WIDE, NFT_METAL_SLIM, NFT_METAL_ROUNDED,
// NFT_PINS, NFT_MINIMAL_BLACK, NFT_MINIMAL_WHITE,
// NFT_TAPE, NFT_WOOD_SLIM, NFT_WOOD_WIDE, NFT_WOOD_TWIGS,
// NFT_CANVAS, NFT_NONE
```

## MANA Transactions (SDK Native)

The SDK also provides a native MANA interface without the crypto toolkit:

```typescript
import { manaUser } from '@dcl/sdk/ethereum'

executeTask(async () => {
  try {
    // Check MANA balance
    const balance = await manaUser.balance()
    console.log('MANA balance:', balance)

    // Send MANA
    const result = await manaUser.send('0x123...abc', 100) // 100 MANA
    console.log('MANA sent:', result)
  } catch (error) {
    console.log('MANA transaction failed:', error)
  }
})
```
