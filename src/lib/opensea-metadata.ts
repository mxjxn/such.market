import { NFTMetadata } from './nft-metadata';

// OpenSea metadata interface following their schema
export interface OpenSeaMetadata {
  // Required fields
  name: string;
  description: string;
  image: string;
  
  // Optional fields
  external_url?: string;
  animation_url?: string;
  background_color?: string;
  
  // Attributes array
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: 'number' | 'boost_number' | 'boost_percentage' | 'date';
    max_value?: number;
  }>;
  
  // Collection metadata
  collection?: {
    name: string;
    family?: string;
  };
  
  // Properties for OpenSea display
  properties?: {
    category?: string;
    files?: Array<{
      uri: string;
      type: string;
    }>;
  };
}

// Helper to convert NFT metadata to OpenSea format
export function convertToOpenSeaMetadata(metadata: NFTMetadata): OpenSeaMetadata {
  const openSeaMetadata: OpenSeaMetadata = {
    name: metadata.name || 'Untitled NFT',
    description: metadata.description || '',
    image: metadata.image || '',
    external_url: metadata.external_url,
    animation_url: metadata.animation_url,
    background_color: metadata.background_color,
    attributes: metadata.attributes?.map(attr => ({
      trait_type: attr.trait_type,
      value: attr.value,
      display_type: attr.display_type,
      max_value: attr.max_value
    })),
    collection: metadata.collection ? {
      name: metadata.collection.name,
      family: metadata.collection.family
    } : undefined,
    properties: metadata.properties ? {
      category: metadata.properties.category,
      files: metadata.properties.files?.map(file => ({
        uri: file.uri,
        type: file.type
      }))
    } : undefined
  };

  return openSeaMetadata;
}

// Helper to validate OpenSea metadata
export function validateOpenSeaMetadata(metadata: OpenSeaMetadata): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!metadata.name) {
    errors.push('name is required');
  }
  if (!metadata.description) {
    errors.push('description is required');
  }
  if (!metadata.image) {
    errors.push('image is required');
  }

  // Validate image URL
  if (metadata.image && !isValidUrl(metadata.image)) {
    errors.push('image must be a valid URL');
  }

  // Validate external URL if present
  if (metadata.external_url && !isValidUrl(metadata.external_url)) {
    errors.push('external_url must be a valid URL');
  }

  // Validate animation URL if present
  if (metadata.animation_url && !isValidUrl(metadata.animation_url)) {
    errors.push('animation_url must be a valid URL');
  }

  // Validate background color if present
  if (metadata.background_color && !isValidHexColor(metadata.background_color)) {
    errors.push('background_color must be a valid hex color');
  }

  // Validate attributes if present
  if (metadata.attributes) {
    metadata.attributes.forEach((attr, index) => {
      if (!attr.trait_type) {
        errors.push(`attribute ${index}: trait_type is required`);
      }
      if (attr.value === undefined || attr.value === null) {
        errors.push(`attribute ${index}: value is required`);
      }
      if (attr.display_type && !['number', 'boost_number', 'boost_percentage', 'date'].includes(attr.display_type)) {
        errors.push(`attribute ${index}: invalid display_type`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Helper to validate URLs
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Helper to validate hex colors
function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
} 