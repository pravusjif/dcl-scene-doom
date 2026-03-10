# DCL Crypto Toolkit Reference

## Installation & Import
```typescript
// Install via npm
npm install dcl-crypto-toolkit

// Import in your code
import * as crypto from 'dcl-crypto-toolkit'
import { executeTask } from '@dcl/sdk/ecs'
```

## Basic Setup

### Initialize Crypto Toolkit
```typescript
// The crypto toolkit is ready to use after import
// All functions are async and should be wrapped in executeTask
executeTask(async () => {
  // Crypto operations here
})
```

## MANA Operations

### Send MANA to Address
```typescript
// Send MANA to a specific address
executeTask(async () => {
  await crypto.mana.send(
    '0x1234567890123456789012345678901234567890',  // toAddress
    10,  // amount in MANA
    true  // waitConfirm (optional, default: false)
  )
})

// Send without waiting for confirmation
executeTask(async () => {
  await crypto.mana.send(
    '0x1234567890123456789012345678901234567890',
    5,
    false
  )
})
```

### Get Player's MANA Balance
```typescript
// Get current player's MANA balance
executeTask(async () => {
  const balance = await crypto.mana.getBalance()
  console.log('MANA Balance:', balance)
})

// Get balance for specific address
executeTask(async () => {
  const balance = await crypto.mana.getBalance(
    '0x1234567890123456789012345678901234567890'
  )
  console.log('Address MANA Balance:', balance)
})
```

## Currency Operations

### Send Currency
```typescript
// Send any ERC20 token
executeTask(async () => {
  await crypto.currency.send(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321',  // toAddress
    1000000000000000000,  // amount in wei
    true  // waitConfirm (optional, default: false)
  )
})
```

### Check Currency Balance
```typescript
// Check balance of any ERC20 token
executeTask(async () => {
  const balance = await crypto.currency.getBalance(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321'   // address (optional, defaults to current player)
  )
  console.log('Token Balance:', balance)
})
```

### Check Currency Allowance
```typescript
// Check how much a contract can spend on behalf of a player
executeTask(async () => {
  const allowance = await crypto.currency.allowance(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321',  // owner
    '0x1111111111111111111111111111111111111111'   // spender
  )
  console.log('Allowance:', allowance)
})
```

### Set Currency Approval
```typescript
// Grant permission for a contract to spend tokens
executeTask(async () => {
  await crypto.currency.setApproval(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321',  // spender
    true,  // waitConfirm (optional, default: false)
    '1000000000000000000000'  // amount in wei (optional, defaults to max)
  )
})
```

### Check Currency Approval Status
```typescript
// Check if a contract is approved to spend tokens
executeTask(async () => {
  const isApproved = await crypto.currency.isApproved(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321',  // owner
    '0x1111111111111111111111111111111111111111'   // spender
  )
  console.log('Is Approved:', isApproved)
})
```

## NFT Operations

### Transfer NFT
```typescript
// Transfer an NFT to another address
executeTask(async () => {
  await crypto.nft.transfer(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321',  // toAddress
    123,  // tokenId
    true  // waitConfirm (optional, default: false)
  )
})
```

### Check NFT Ownership
```typescript
// Check if a player owns a specific NFT
executeTask(async () => {
  const balance = await crypto.nft.getBalance(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    123,  // tokenId
    '0x0987654321098765432109876543210987654321'   // address (optional, defaults to current player)
  )
  console.log('NFT Balance:', balance)
})
```

### Check NFT Approval for All
```typescript
// Check if a contract is approved to handle all NFTs of a collection
executeTask(async () => {
  const isApproved = await crypto.nft.isApprovedForAll(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321',  // assetHolder
    '0x1111111111111111111111111111111111111111'   // operator
  )
  console.log('Is Approved For All:', isApproved)
})
```

### Set NFT Approval for All
```typescript
// Grant permission for a contract to handle all NFTs of a collection
executeTask(async () => {
  await crypto.nft.setApprovalForAll(
    '0x1234567890123456789012345678901234567890',  // contractAddress
    '0x0987654321098765432109876543210987654321',  // operator
    true,  // approved (optional, default: true)
    true   // waitConfirm (optional, default: false)
  )
})
```

## Message Signing

### Sign Message
```typescript
// Sign a message with the player's wallet
executeTask(async () => {
  const signature = await crypto.signMessage('Hello Decentraland!')
  console.log('Signature:', signature)
})

// Sign with custom message
executeTask(async () => {
  const message = 'I agree to the terms and conditions'
  const signature = await crypto.signMessage(message)
  console.log('Signed message:', signature)
})
```

## Decentraland Contracts

### Access Predefined Contracts
```typescript
// Use predefined Decentraland contract addresses
console.log('MANA Token:', crypto.contract.mainnet.MANAToken)
console.log('Marketplace:', crypto.contract.mainnet.Marketplace)
console.log('LAND Registry:', crypto.contract.mainnet.LANDRegistry)
```

### Available Contract Addresses
```typescript
// Key mainnet contracts
crypto.contract.mainnet.MANAToken
crypto.contract.mainnet.Marketplace
crypto.contract.mainnet.LANDRegistry
crypto.contract.mainnet.EstateRegistry
crypto.contract.mainnet.Halloween2019Collection
crypto.contract.mainnet.Xmas2019Collection
crypto.contract.mainnet.MCHCollection
crypto.contract.mainnet.CommunityContestCollection
crypto.contract.mainnet.DappcraftMoonminerCollection
crypto.contract.mainnet.DCLLaunchCollection
crypto.contract.mainnet.DCGCollection
crypto.contract.mainnet.DCNSCollection
// ... plus many seasonal DG collections (DGSummer2020Collection, DGFall2020Collection, etc.)
```

## Marketplace Operations

### Buy Item from Marketplace
```typescript
// Buy an item from the Decentraland marketplace
executeTask(async () => {
  await crypto.marketplace.buyOrder(
    '0x1234567890123456789012345678901234567890',  // nftAddress
    123,  // assetId
    '1000000000000000000'  // price in wei
  )
})
```

### Check Player's Marketplace Authorizations
```typescript
// Check if player has authorized marketplace to handle their tokens
executeTask(async () => {
  const isAuthorized = await crypto.marketplace.isAuthorized()
  console.log('Marketplace Authorized:', isAuthorized)
})
```

### Sell Item from Scene
```typescript
// List an item for sale on the marketplace
executeTask(async () => {
  await crypto.marketplace.sellOrder(
    '0x1234567890123456789012345678901234567890',  // nftAddress
    123,  // assetId
    '1000000000000000000',  // price in wei
    '1000000000000000000'   // expiresAt timestamp
  )
})
```

### Cancel Marketplace Order
```typescript
// Cancel a marketplace listing
executeTask(async () => {
  await crypto.marketplace.cancelOrder(
    '0x1234567890123456789012345678901234567890',  // nftAddress
    123  // assetId
  )
})
```

## Third Party Contract Operations

### Check Currency Approval for Third Party
```typescript
// Check if a third-party contract can spend player's tokens
executeTask(async () => {
  const isApproved = await crypto.currency.isApproved(
    crypto.contract.mainnet.MANAToken,
    '0x1234567890123456789012345678901234567890'  // thirdPartyContract
  )
  console.log('Third Party Approved:', isApproved)
})
```

### Grant Currency Approval to Third Party
```typescript
// Allow a third-party contract to spend player's tokens
executeTask(async () => {
  await crypto.currency.setApproval(
    crypto.contract.mainnet.MANAToken,
    '0x1234567890123456789012345678901234567890',  // thirdPartyContract
    true,  // waitConfirm
    '1000000000000000000000'  // amount in wei
  )
})
```

### Check NFT Approval for Third Party
```typescript
// Check if a third-party contract can handle player's NFTs
executeTask(async () => {
  const isApproved = await crypto.nft.isApprovedForAll(
    crypto.contract.mainnet.Halloween2019Collection,
    '0x1234567890123456789012345678901234567890'  // thirdPartyContract
  )
  console.log('Third Party NFT Approved:', isApproved)
})
```

### Grant NFT Approval to Third Party
```typescript
// Allow a third-party contract to handle player's NFTs
executeTask(async () => {
  await crypto.nft.setApprovalForAll(
    crypto.contract.mainnet.Halloween2019Collection,
    '0x1234567890123456789012345678901234567890',  // thirdPartyContract
    true,  // approved
    true   // waitConfirm
  )
})
```

## Custom Contract Interactions

### Call Any Contract Function
```typescript
// Define contract ABI (simplified example)
const LANDAbi = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  }
]

// Get contract instance
executeTask(async () => {
  const contract = await crypto.contract.getContract(
    '0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d',  // contractAddress
    LANDAbi
  )

  // Call contract function
  const balance = await contract.balanceOf('0x1234567890123456789012345678901234567890')
  console.log('LAND Balance:', balance)
})
```

### Get Contract with Request Manager
```typescript
// Get contract with additional request manager for more control
executeTask(async () => {
  const { contract, requestManager } = await crypto.contract.getContract(
    crypto.contract.mainnet.MANAToken
  )

  // Use request manager for custom transaction handling
  const balance = await contract.balanceOf('0x1234567890123456789012345678901234567890')
  console.log('MANA Balance:', balance)
})
```

## Wearable Data

### Get List of Wearables
```typescript
// Get all wearables
executeTask(async () => {
  const wearables = await crypto.wearable.getListOfWearables()
  console.log('All Wearables:', wearables)
})

// Get wearables with filters
executeTask(async () => {
  const filteredWearables = await crypto.wearable.getListOfWearables({
    collectionIds: ['urn:decentraland:ethereum:collections-v1:mf_sammichgamer'],
    wearableIds: ['urn:decentraland:ethereum:collections-v1:mf_sammichgamer:mf_sammichgamer'],
    textSearch: 'sammich'
  })
  console.log('Filtered Wearables:', filteredWearables)
})
```

### Wearable Filter Options
```typescript
interface WearableFilters {
  collectionIds?: string[]    // Filter by collection URNs
  wearableIds?: string[]      // Filter by specific wearable URNs
  textSearch?: string         // Search by text in wearable name/description
}
```

## Common Crypto Patterns

### Complete Payment Flow
```typescript
// Complete payment flow with approval checks
async function processPayment(amount: number, recipient: string) {
  try {
    // Check MANA balance
    const balance = await crypto.mana.getBalance()
    if (balance < amount) {
      throw new Error('Insufficient MANA balance')
    }

    // Send MANA
    await crypto.mana.send(recipient, amount, true)

    console.log(`Payment of ${amount} MANA sent to ${recipient}`)
    return true
  } catch (error) {
    console.error('Payment failed:', error)
    return false
  }
}

// Usage
executeTask(async () => {
  const success = await processPayment(10, '0x1234567890123456789012345678901234567890')
  if (success) {
    console.log('Payment successful!')
  }
})
```

### NFT Trading System
```typescript
// Complete NFT trading system
class NFTTradingSystem {
  async checkOwnership(contractAddress: string, tokenId: number): Promise<boolean> {
    const balance = await crypto.nft.getBalance(contractAddress, tokenId)
    return balance > 0
  }

  async transferNFT(contractAddress: string, toAddress: string, tokenId: number): Promise<boolean> {
    try {
      const ownsNFT = await this.checkOwnership(contractAddress, tokenId)
      if (!ownsNFT) {
        throw new Error('Player does not own this NFT')
      }

      await crypto.nft.transfer(contractAddress, toAddress, tokenId, true)
      console.log(`NFT ${tokenId} transferred to ${toAddress}`)
      return true
    } catch (error) {
      console.error('NFT transfer failed:', error)
      return false
    }
  }

  async listForSale(contractAddress: string, tokenId: number, price: string): Promise<boolean> {
    try {
      // Check marketplace authorization
      const isAuthorized = await crypto.marketplace.isAuthorized()
      if (!isAuthorized) {
        // Grant authorization
        await crypto.nft.setApprovalForAll(contractAddress, crypto.contract.mainnet.Marketplace, true, true)
      }

      // List for sale
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
      await crypto.marketplace.sellOrder(contractAddress, tokenId, price, expiresAt.toString())

      console.log(`NFT ${tokenId} listed for sale at ${price} wei`)
      return true
    } catch (error) {
      console.error('Listing failed:', error)
      return false
    }
  }
}
```

### Marketplace Integration
```typescript
// Complete marketplace integration
class MarketplaceIntegration {
  async buyItem(nftAddress: string, assetId: number, price: string): Promise<boolean> {
    try {
      // Check if player has enough MANA
      const balance = await crypto.mana.getBalance()
      const priceInMana = parseFloat(price) / 1e18 // Convert from wei to MANA

      if (balance < priceInMana) {
        throw new Error('Insufficient MANA balance')
      }

      // Check marketplace authorization
      const isAuthorized = await crypto.marketplace.isAuthorized()
      if (!isAuthorized) {
        await crypto.mana.setApproval(crypto.contract.mainnet.Marketplace, true, price)
      }

      // Buy the item
      await crypto.marketplace.buyOrder(nftAddress, assetId, price)

      console.log(`Successfully purchased NFT ${assetId} for ${priceInMana} MANA`)
      return true
    } catch (error) {
      console.error('Purchase failed:', error)
      return false
    }
  }

  async cancelListing(nftAddress: string, assetId: number): Promise<boolean> {
    try {
      await crypto.marketplace.cancelOrder(nftAddress, assetId)
      console.log(`Cancelled listing for NFT ${assetId}`)
      return true
    } catch (error) {
      console.error('Cancellation failed:', error)
      return false
    }
  }
}
```

## Error Handling

### Common Error Patterns
```typescript
// Handle common crypto operation errors
async function safeCryptoOperation(operation: () => Promise<any>) {
  try {
    const result = await operation()
    return { success: true, result }
  } catch (error: any) {
    if (error.message.includes('insufficient funds')) {
      console.error('Insufficient balance for transaction')
      return { success: false, error: 'INSUFFICIENT_BALANCE' }
    } else if (error.message.includes('user rejected')) {
      console.error('User rejected the transaction')
      return { success: false, error: 'USER_REJECTED' }
    } else if (error.message.includes('network error')) {
      console.error('Network error occurred')
      return { success: false, error: 'NETWORK_ERROR' }
    } else {
      console.error('Unknown error:', error)
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }
}

// Usage
executeTask(async () => {
  const result = await safeCryptoOperation(async () => {
    return await crypto.mana.send('0x1234567890123456789012345678901234567890', 1, true)
  })

  if (result.success) {
    console.log('Operation successful:', result.result)
  } else {
    console.log('Operation failed:', result.error)
  }
})
```

## Best Practices

### Security Guidelines
```typescript
// 1. Always validate addresses
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// 2. Always validate amounts
function isValidAmount(amount: number): boolean {
  return amount > 0 && Number.isFinite(amount)
}

// 3. Use proper error handling
async function secureCryptoOperation(operation: () => Promise<any>) {
  try {
    return await operation()
  } catch (error: any) {
    console.error('Crypto operation failed:', error)
    throw new Error(`Operation failed: ${error.message}`)
  }
}

// 4. Validate user input
function validateTransactionInput(toAddress: string, amount: number): boolean {
  if (!isValidAddress(toAddress)) {
    throw new Error('Invalid recipient address')
  }
  if (!isValidAmount(amount)) {
    throw new Error('Invalid amount')
  }
  return true
}
```
