import { SEAPORT_CONFIG } from '../seaport/config';

// Types for Seaport order components
export interface OfferItem {
  itemType: number;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
}

export interface ConsiderationItem {
  itemType: number;
  token: string;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
}

// Types for Seaport database operations
export interface SeaportOrder {
  id: string;
  order_hash: string;
  offerer_address: string;
  fulfiller_address?: string;
  order_type: 'listing' | 'offer' | 'auction';
  status: 'active' | 'fulfilled' | 'cancelled' | 'expired';
  start_time: string;
  end_time: string;
  salt: string;
  conduit_key?: string;
  zone_hash?: string;
  counter: number;
  offer_items: OfferItem[];
  consideration_items: ConsiderationItem[];
  fc_user_id?: number;
  frame_url?: string;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string;
}

export interface SeaportOrderItem {
  id: string;
  order_id: string;
  item_type: 'offer' | 'consideration';
  token_type: number;
  token_address?: string;
  token_id?: string;
  amount: string;
  recipient_address?: string;
  start_amount?: string;
  end_amount?: string;
  collection_id?: string;
  nft_id?: string;
  created_at: string;
}

export interface CreateOrderParams {
  orderHash: string;
  offererAddress: string;
  orderType: 'listing' | 'offer' | 'auction';
  startTime: number;
  endTime: number;
  salt: string;
  counter: number;
  offerItems: OfferItem[];
  considerationItems: ConsiderationItem[];
  fcUserId?: number;
  frameUrl?: string;
  conduitKey?: string;
  zoneHash?: string;
}

export interface ListingsQueryParams {
  contractAddress?: string;
  tokenId?: string;
  page?: number;
  limit?: number;
  status?: 'active' | 'fulfilled' | 'cancelled' | 'expired';
  orderType?: 'listing' | 'offer' | 'auction';
}

// TODO: Implement once database migration is run
export async function storeOrder(params: CreateOrderParams): Promise<SeaportOrder> {
  console.log('TODO: Store Seaport order in database:', params);
  
  // Placeholder implementation
  const order: SeaportOrder = {
    id: 'placeholder-id',
    order_hash: params.orderHash,
    offerer_address: params.offererAddress.toLowerCase(),
    order_type: params.orderType,
    status: 'active',
    start_time: new Date(params.startTime * 1000).toISOString(),
    end_time: new Date(params.endTime * 1000).toISOString(),
    salt: params.salt,
    conduit_key: params.conduitKey || SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    zone_hash: params.zoneHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
    counter: params.counter,
    offer_items: params.offerItems,
    consideration_items: params.considerationItems,
    fc_user_id: params.fcUserId,
    frame_url: params.frameUrl,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  return order;
}

// TODO: Implement once database migration is run
export async function getOrderByHash(orderHash: string): Promise<SeaportOrder | null> {
  console.log('TODO: Get Seaport order by hash:', orderHash);
  return null;
}

// TODO: Implement once database migration is run
export async function getActiveListings(
  contractAddress: string,
  page: number = 0,
  limit: number = 20
): Promise<{ listings: SeaportOrder[]; total: number }> {
  console.log('TODO: Get active listings for contract:', contractAddress, 'page:', page, 'limit:', limit);
  return { listings: [], total: 0 };
}

// TODO: Implement once database migration is run
export async function updateOrderStatus(
  orderHash: string, 
  status: 'active' | 'fulfilled' | 'cancelled' | 'expired',
  fulfillerAddress?: string
): Promise<void> {
  console.log('TODO: Update order status:', orderHash, status, fulfillerAddress);
}

// TODO: Implement once database migration is run
export async function storeNotification(
  fcUserId: number,
  orderId: string,
  notificationType: 'offer_received' | 'listing_sold' | 'offer_accepted' | 'auction_ending',
  message: string
): Promise<void> {
  console.log('TODO: Store notification:', { fcUserId, orderId, notificationType, message });
}

// TODO: Implement once database migration is run
export async function getUserNotifications(
  fcUserId: number,
  isRead?: boolean,
  page: number = 0,
  limit: number = 20
): Promise<{ notifications: Array<{ id: string; message: string; created_at: string; is_read: boolean }>; total: number }> {
  console.log('TODO: Get user notifications:', { fcUserId, isRead, page, limit });
  return { notifications: [], total: 0 };
}

// TODO: Implement once database migration is run
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  console.log('TODO: Mark notification as read:', notificationId);
}

// Utility function to generate a random salt
export function generateSalt(): string {
  return '0x' + Math.random().toString(16).slice(2, 66).padEnd(64, '0');
}

// Utility function to get current timestamp
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
} 