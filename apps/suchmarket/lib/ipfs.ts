import { CONFIG } from './config'

export function resolveIPFSUrl(uri: string): string {
  if (!uri) return uri
  if (uri.startsWith('ipfs://')) {
    const ipfsHash = uri.replace('ipfs://', '')
    const gateway = (CONFIG.IPFS_URL || 'https://ipfs.io').replace(/\/$/, '')
    return `${gateway}/ipfs/${ipfsHash}`
  }
  if (uri.includes('/ipfs/')) {
    const ipfsHash = uri.split('/ipfs/')[1]?.split('/')[0]
    if (ipfsHash) {
      const gateway = (CONFIG.IPFS_URL || 'https://ipfs.io').replace(/\/$/, '')
      return `${gateway}/ipfs/${ipfsHash}`
    }
  }
  return uri
}