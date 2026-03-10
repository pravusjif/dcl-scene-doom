---
name: dcl-crypto
description: "Assists with Decentraland SDK7 blockchain integration when the user mentions MANA, ERC20, ERC721, NFTs, blockchain, crypto, dcl-crypto-toolkit, wallets, transactions, smart contracts, marketplace, token gating, or message signing."
---

# Decentraland SDK7 Blockchain Integration

This skill covers all blockchain-related functionality in Decentraland SDK7 scenes, including the `dcl-crypto-toolkit` library, raw Ethereum provider access, signed fetch, NFT display, and common patterns like token gating and tip jars.

## 1. Safety-First Guidance

All blockchain operations are asynchronous and interact with real wallets and real tokens. Follow these rules strictly:

- **Always wrap blockchain calls in `executeTask()`** — blockchain operations cannot run synchronously in the scene lifecycle.
- **Always use try/catch** — network failures, user rejections, and insufficient funds are all common.
- **Always check if the user is a guest** before any wallet operation. Guests have no wallet and all crypto calls will fail.
- **Never hardcode private keys or secrets** in scene code. Scenes run client-side and all code is visible.
- **Validate all addresses** with a regex check (`/^0x[a-fA-F0-9]{40}$/`) before passing them to contract calls.
- **Validate amounts** — ensure they are positive, finite numbers before sending transactions.
- **Handle user rejection gracefully** — the player can decline any transaction prompt in their wallet.

```typescript
import { executeTask } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'

// Safety pattern: always check guest status first
executeTask(async () => {
  try {
    const player = getPlayer()
    if (!player || player.isGuest) {
      console.log('Player has no wallet — cannot perform blockchain operations')
      return
    }
    // Safe to proceed with blockchain calls
  } catch (error) {
    console.error('Blockchain operation failed:', error)
  }
})
```

## 2. Setup

### Install the Crypto Toolkit

```bash
npm install dcl-crypto-toolkit
```

For raw contract interaction (without the toolkit), you also need:

```bash
npm install eth-connect
```

### Imports

```typescript
// Crypto toolkit (high-level API)
import * as crypto from 'dcl-crypto-toolkit'

// Required for async blockchain calls
import { executeTask } from '@dcl/sdk/ecs'

// For raw contract interaction
import { RequestManager, ContractFactory } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'

// For signed HTTP requests
import { signedFetch } from '@dcl/sdk/network'

// For player/wallet info
import { getPlayer } from '@dcl/sdk/src/players'

// For NFT display
import { NftShape } from '@dcl/sdk/ecs'
```

### executeTask Wrapper

Every blockchain operation must be wrapped in `executeTask`:

```typescript
executeTask(async () => {
  // All blockchain operations go here
})
```

## 3. Player Identity

### Get Wallet Address

```typescript
executeTask(async () => {
  const player = getPlayer()
  if (player && !player.isGuest) {
    console.log('Wallet address:', player.userId)
  } else {
    console.log('Player is a guest (no wallet)')
  }
})
```

### Check If Guest

```typescript
function playerHasWallet(): boolean {
  const player = getPlayer()
  return player !== undefined && !player.isGuest
}
```

## 4. MANA Operations

MANA is Decentraland's native ERC20 token. The crypto toolkit provides dedicated MANA functions.

### Send MANA

```typescript
executeTask(async () => {
  await crypto.mana.send(
    '0xRecipientAddress',  // toAddress
    10,                     // amount in MANA
    true                    // waitConfirm (optional, default: false)
  )
})
```

### Check MANA Balance

```typescript
executeTask(async () => {
  // Current player's balance
  const myBalance = await crypto.mana.getBalance()

  // Specific address balance
  const otherBalance = await crypto.mana.getBalance('0xSomeAddress')
})
```

### Approve MANA Spending

```typescript
executeTask(async () => {
  await crypto.currency.setApproval(
    crypto.contract.mainnet.MANAToken,  // MANA contract
    '0xSpenderContract',                 // who can spend
    true,                                // waitConfirm
    '1000000000000000000000'             // amount in wei (optional, defaults to max)
  )
})
```

## 5. ERC20 Operations (Generic Tokens)

### Send Any ERC20 Token

```typescript
executeTask(async () => {
  await crypto.currency.send(
    '0xTokenContractAddress',   // contractAddress
    '0xRecipientAddress',       // toAddress
    1000000000000000000,        // amount in wei
    true                        // waitConfirm
  )
})
```

### Check Token Balance

```typescript
executeTask(async () => {
  const balance = await crypto.currency.getBalance(
    '0xTokenContractAddress',   // contractAddress
    '0xOptionalAddress'         // defaults to current player
  )
})
```

### Check Allowance

```typescript
executeTask(async () => {
  const allowance = await crypto.currency.allowance(
    '0xTokenContractAddress',   // contractAddress
    '0xOwnerAddress',           // owner
    '0xSpenderAddress'          // spender
  )
})
```

### Set Approval

```typescript
executeTask(async () => {
  await crypto.currency.setApproval(
    '0xTokenContractAddress',   // contractAddress
    '0xSpenderAddress',         // spender
    true,                       // waitConfirm
    '1000000000000000000000'    // amount in wei (optional)
  )
})
```

### Check Approval Status

```typescript
executeTask(async () => {
  const isApproved = await crypto.currency.isApproved(
    '0xTokenContractAddress',
    '0xOwnerAddress',
    '0xSpenderAddress'
  )
})
```

## 6. ERC721/NFT Operations

### Check NFT Ownership

```typescript
executeTask(async () => {
  const balance = await crypto.nft.getBalance(
    '0xNFTContractAddress',    // contractAddress
    123,                        // tokenId
    '0xOptionalAddress'         // defaults to current player
  )
  const ownsNFT = balance > 0
})
```

### Transfer NFT

```typescript
executeTask(async () => {
  await crypto.nft.transfer(
    '0xNFTContractAddress',    // contractAddress
    '0xRecipientAddress',      // toAddress
    123,                        // tokenId
    true                        // waitConfirm
  )
})
```

### NFT Approval for All

```typescript
executeTask(async () => {
  // Check
  const approved = await crypto.nft.isApprovedForAll(
    '0xNFTContractAddress',
    '0xAssetHolder',
    '0xOperator'
  )

  // Grant
  await crypto.nft.setApprovalForAll(
    '0xNFTContractAddress',
    '0xOperator',
    true,   // approved
    true    // waitConfirm
  )
})
```

### Display NFT in Scene with NftShape

```typescript
import { engine, Entity, NftShape, NftFrameType, Transform } from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'

const nftFrame = engine.addEntity()

Transform.create(nftFrame, {
  position: Vector3.create(8, 2, 8)
})

NftShape.create(nftFrame, {
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

## 7. Smart Contract Interaction (Raw)

For contracts not covered by the crypto toolkit, use `eth-connect` directly.

### Provider Setup

```typescript
import { RequestManager, ContractFactory } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'

executeTask(async () => {
  const provider = createEthereumProvider()
  const requestManager = new RequestManager(provider)

  // Check gas price
  const gasPrice = await requestManager.eth_gasPrice()

  // Check ETH balance
  const balance = await requestManager.eth_getBalance('0xAddress', 'latest')
})
```

### Create Contract Instance

```typescript
import { RequestManager, ContractFactory } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'
import { abi } from '../contracts/myContract'

executeTask(async () => {
  const provider = createEthereumProvider()
  const requestManager = new RequestManager(provider)
  const factory = new ContractFactory(requestManager, abi)
  const contract = (await factory.at('0xContractAddress')) as any
})
```

### ABI Format

Store ABIs in separate files (e.g., `src/contracts/mana.ts`):

```typescript
export const abi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  }
  // ... more functions/events
]
```

### Read vs Write Methods

```typescript
executeTask(async () => {
  const player = getPlayer()
  if (!player || player.isGuest) return

  // Read operation (free, no gas)
  const balance = await contract.balanceOf(player.userId)

  // Write operation (costs gas, prompts wallet)
  const txHash = await contract.transfer(
    '0xRecipient',
    100,
    {
      from: player.userId,
      gas: 100000,
      gasPrice: await requestManager.eth_gasPrice()
    }
  )
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

## 8. Marketplace Integration

### Buy from Marketplace

```typescript
executeTask(async () => {
  await crypto.marketplace.buyOrder(
    '0xNFTAddress',
    123,                        // assetId
    '1000000000000000000'       // price in wei
  )
})
```

### Sell on Marketplace

```typescript
executeTask(async () => {
  // Ensure marketplace is authorized to handle NFTs
  const isAuthorized = await crypto.marketplace.isAuthorized()
  if (!isAuthorized) {
    await crypto.nft.setApprovalForAll(
      '0xNFTContractAddress',
      crypto.contract.mainnet.Marketplace,
      true,
      true
    )
  }

  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  await crypto.marketplace.sellOrder(
    '0xNFTAddress',
    123,
    '1000000000000000000',       // price in wei
    expiresAt.toString()
  )
})
```

### Cancel Marketplace Order

```typescript
executeTask(async () => {
  await crypto.marketplace.cancelOrder('0xNFTAddress', 123)
})
```

### Check Marketplace Authorization

```typescript
executeTask(async () => {
  const isAuthorized = await crypto.marketplace.isAuthorized()
})
```

### Open Marketplace in Browser

Use `openExternalUrl` to send the player to the marketplace:

```typescript
import { openExternalUrl } from '~system/RestrictedActions'

openExternalUrl({ url: 'https://market.decentraland.org' })
```

## 9. Message Signing

### Sign a Message

```typescript
executeTask(async () => {
  const signature = await crypto.signMessage('Hello Decentraland!')
  console.log('Signature:', signature)
})
```

### signedFetch for Authenticated API Calls

`signedFetch` automatically includes the player's identity and a cryptographic signature in the request headers, allowing your backend to verify the request came from the actual player.

```typescript
import { signedFetch } from '@dcl/sdk/network'

executeTask(async () => {
  try {
    // GET request
    const getResponse = await signedFetch('https://api.example.com/data')
    const getData = await getResponse.json()

    // POST request
    const postResponse = await signedFetch('https://api.example.com/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claimReward', amount: 100 })
    })
    const postData = await postResponse.json()
  } catch (error) {
    console.error('signedFetch failed:', error)
  }
})
```

## 10. Token Gating Pattern

Check NFT/token ownership to grant or deny access to areas or features.

```typescript
import * as crypto from 'dcl-crypto-toolkit'
import { executeTask } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'

const REQUIRED_NFT_CONTRACT = '0xYourNFTContract'
const REQUIRED_TOKEN_ID = 1

executeTask(async () => {
  try {
    const player = getPlayer()
    if (!player || player.isGuest) {
      console.log('Connect a wallet to access this area')
      return
    }

    const balance = await crypto.nft.getBalance(
      REQUIRED_NFT_CONTRACT,
      REQUIRED_TOKEN_ID
    )

    if (balance > 0) {
      // Player owns the NFT — grant access
      openGatedDoor()
    } else {
      // Player does not own the NFT — deny access
      showAccessDeniedMessage()
    }
  } catch (error) {
    console.error('Token gate check failed:', error)
  }
})
```

### Token Gate by ERC20 Balance

```typescript
executeTask(async () => {
  const player = getPlayer()
  if (!player || player.isGuest) return

  const manaBalance = await crypto.mana.getBalance()
  if (manaBalance >= 100) {
    // Player has at least 100 MANA — grant VIP access
    grantVIPAccess()
  }
})
```

## 11. Decision Tree

| I want to... | Use this |
|---|---|
| Send MANA to another player | `crypto.mana.send()` |
| Check MANA balance | `crypto.mana.getBalance()` |
| Send any ERC20 token | `crypto.currency.send()` |
| Check ERC20 balance | `crypto.currency.getBalance()` |
| Transfer an NFT | `crypto.nft.transfer()` |
| Check if player owns an NFT | `crypto.nft.getBalance()` |
| Display an NFT in scene | `NftShape.create()` |
| Buy from marketplace | `crypto.marketplace.buyOrder()` |
| List NFT for sale | `crypto.marketplace.sellOrder()` |
| Sign a message | `crypto.signMessage()` |
| Make authenticated API call | `signedFetch()` |
| Call a custom smart contract (read) | `contract.methodName()` via `eth-connect` |
| Call a custom smart contract (write) | `contract.methodName({ from, gas, gasPrice })` via `eth-connect` |
| Check gas price | `requestManager.eth_gasPrice()` |
| Get player's wallet address | `getPlayer().userId` |
| Check if player is guest | `getPlayer().isGuest` |
| Open marketplace in browser | `openExternalUrl()` |
| Get wearable data | `crypto.wearable.getListOfWearables()` |

## 12. Common Recipes

### Tip Jar

```typescript
import * as crypto from 'dcl-crypto-toolkit'
import { executeTask } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'

const CREATOR_WALLET = '0xYourWalletAddress'
const TIP_AMOUNTS = [1, 5, 10] // MANA

function sendTip(amount: number) {
  executeTask(async () => {
    try {
      const player = getPlayer()
      if (!player || player.isGuest) {
        console.log('Connect wallet to send tips')
        return
      }

      const balance = await crypto.mana.getBalance()
      if (balance < amount) {
        console.log('Insufficient MANA balance')
        return
      }

      await crypto.mana.send(CREATOR_WALLET, amount, true)
      console.log(`Tip of ${amount} MANA sent!`)
    } catch (error) {
      console.error('Tip failed:', error)
    }
  })
}
```

### NFT Gallery

```typescript
import { engine, NftShape, NftFrameType, Transform } from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'

interface NFTDisplay {
  urn: string
  position: { x: number; y: number; z: number }
  style?: number
}

function createNFTGallery(nfts: NFTDisplay[]) {
  for (const nft of nfts) {
    const entity = engine.addEntity()
    Transform.create(entity, {
      position: Vector3.create(nft.position.x, nft.position.y, nft.position.z)
    })
    NftShape.create(entity, {
      urn: nft.urn,
      color: Color4.White(),
      style: nft.style ?? NftFrameType.NFT_CLASSIC
    })
  }
}

// Usage
createNFTGallery([
  {
    urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558536',
    position: { x: 4, y: 2, z: 1 },
    style: NftFrameType.NFT_GOLD_EDGES
  },
  {
    urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558537',
    position: { x: 8, y: 2, z: 1 },
    style: NftFrameType.NFT_BAROQUE_ORNAMENT
  }
])
```

### Token-Gated Door

```typescript
import * as crypto from 'dcl-crypto-toolkit'
import { engine, Transform, GltfContainer, Entity } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'
import { executeTask } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'

const REQUIRED_NFT_CONTRACT = '0xYourNFTContract'
const REQUIRED_TOKEN_ID = 1

let doorEntity: Entity
let doorOpen = false

function setupDoor() {
  doorEntity = engine.addEntity()
  Transform.create(doorEntity, {
    position: Vector3.create(8, 1, 8),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })
  GltfContainer.create(doorEntity, { src: 'models/door.glb' })
}

function checkAccess() {
  executeTask(async () => {
    try {
      const player = getPlayer()
      if (!player || player.isGuest) {
        console.log('Connect wallet to enter')
        return
      }

      const balance = await crypto.nft.getBalance(
        REQUIRED_NFT_CONTRACT,
        REQUIRED_TOKEN_ID
      )

      if (balance > 0) {
        // Open the door
        const transform = Transform.getMutable(doorEntity)
        transform.rotation = Quaternion.fromEulerDegrees(0, 90, 0)
        doorOpen = true
      } else {
        console.log('You need the required NFT to enter')
      }
    } catch (error) {
      console.error('Access check failed:', error)
    }
  })
}
```

### Marketplace Link Button

```typescript
import { openExternalUrl } from '~system/RestrictedActions'

function openMarketplaceForItem(contractAddress: string, tokenId: string) {
  openExternalUrl({
    url: `https://market.decentraland.org/contracts/${contractAddress}/tokens/${tokenId}`
  })
}
```

## 13. Reference Files

For detailed API documentation and code examples, see the reference files in this skill:

- `references/crypto-toolkit.md` — Full dcl-crypto-toolkit API reference including MANA, currency, NFT, marketplace, wearable, contract, and message signing operations with complete code examples.
- `references/blockchain-basics.md` — Core blockchain patterns for SDK7: executeTask usage, eth-connect provider/contract setup, signedFetch, getUserData for wallet info, and raw smart contract interaction examples.
