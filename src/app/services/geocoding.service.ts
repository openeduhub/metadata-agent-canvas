import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { PlatformDetectionService } from './platform-detection.service';

/**
 * Geocoding service using Photon API from Komoot
 * Converts addresses to geo-coordinates (latitude/longitude)
 */
@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private readonly RATE_LIMIT_MS = 1000; // 1 request per second
  private lastRequestTime = 0;

  constructor(private platformDetection: PlatformDetectionService) {}

  /**
   * Get the appropriate Photon API URL based on platform
   * - Local development: http://localhost:3001/geocoding
   * - Netlify: /.netlify/functions/geocode-proxy
   * - Vercel: /api/geocode-proxy
   */
  private getPhotonUrl(): string {
    if (environment.production) {
      const proxyUrl = (environment as any).geocoding?.proxyUrl || this.platformDetection.getGeocodingProxyUrl();
      return proxyUrl;
    }
    
    // Development: Use URL from environment config
    const proxyUrl = (environment as any).geocoding?.proxyUrl || 'http://localhost:3001/geocoding';
    return proxyUrl;
  }

  /**
   * Geocode an address using Photon API
   * @param address PostalAddress object with street, postal code, city, etc.
   * @returns Geocoding result with coordinates and enriched location data
   */
  async geocodeAddress(address: any): Promise<GeocodingResult | null> {
    try {
      // Build query string from address components
      const queryParts: string[] = [];
      
      if (address.streetAddress) {
        queryParts.push(address.streetAddress);
      }
      if (address.postalCode) {
        queryParts.push(address.postalCode);
      }
      if (address.addressLocality) {
        queryParts.push(address.addressLocality);
      }
      if (address.addressRegion) {
        queryParts.push(address.addressRegion);
      }
      if (address.addressCountry) {
        queryParts.push(address.addressCountry);
      }

      // No address components available
      if (queryParts.length === 0) {
        return null;
      }

      const query = queryParts.join(', ');
      // Rate limiting: Wait if needed to respect 1 request/second
      await this.waitForRateLimit();

      // Build API URL (automatically uses proxy on Netlify, direct on localhost)
      const baseUrl = this.getPhotonUrl();
      const url = `${baseUrl}?q=${encodeURIComponent(query)}&lang=de&limit=1`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`❌ Photon API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Check if we got results
      if (!data.features || data.features.length === 0) {
        return null;
      }

      const feature = data.features[0];
      const coords = feature.geometry?.coordinates;
      const props = feature.properties || {};

      if (!coords || coords.length < 2) {
        console.error('❌ Invalid coordinates in Photon response');
        return null;
      }

      const result: GeocodingResult = {
        latitude: coords[1],  // Photon returns [longitude, latitude]
        longitude: coords[0],
        // Enriched data from Photon
        enrichedAddress: {
          streetAddress: props.street || address.streetAddress,
          housenumber: props.housenumber,
          postalCode: props.postcode || address.postalCode,
          addressLocality: props.city || address.addressLocality,
          addressRegion: props.state || address.addressRegion,
          addressCountry: props.country || address.addressCountry,
          countryCode: props.countrycode || address.addressCountry,
          district: props.district
        },
        osmData: {
          osmType: props.osm_type,
          osmId: props.osm_id,
          osmKey: props.osm_key,
          osmValue: props.osm_value,
          type: props.type,
          extent: props.extent
        }
      };

      return result;

    } catch (error) {
      console.error('❌ Geocoding error:', error);
      return null;
    }
  }

  /**
   * Geocode a Place object (with nested address)
   */
  async geocodePlace(place: any): Promise<any> {
    if (!place || !place.address) {
      return place; // No address to geocode
    }

    const geoResult = await this.geocodeAddress(place.address);
    
    if (!geoResult) {
      return place; // Geocoding failed, return original
    }

    // Enrich place with geo coordinates
    return {
      ...place,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geoResult.latitude,
        longitude: geoResult.longitude
      },
      // Optionally update address with enriched data
      address: {
        '@type': 'PostalAddress',
        ...place.address,
        ...geoResult.enrichedAddress,
        // Combine street and housenumber if available
        streetAddress: geoResult.enrichedAddress.housenumber
          ? `${geoResult.enrichedAddress.streetAddress} ${geoResult.enrichedAddress.housenumber}`
          : geoResult.enrichedAddress.streetAddress || place.address.streetAddress
      }
    };
  }

  /**
   * Geocode all locations in an array
   */
  async geocodeLocations(locations: any[]): Promise<any[]> {
    if (!locations || locations.length === 0) {
      return locations;
    }

    // Process sequentially to respect rate limit (not in parallel)
    const geocodedLocations: any[] = [];
    for (const location of locations) {
      // Check if location has an address to geocode
      // Skip VirtualLocation (has url but no address) and already geocoded places
      const hasAddress = location.address && 
        (location.address.streetAddress || location.address.addressLocality || location.address.postalCode);
      const needsGeocoding = !location.geo || 
        (typeof location.geo === 'object' && Object.keys(location.geo).length === 0);
      
      if (hasAddress && needsGeocoding) {
        const geocoded = await this.geocodePlace(location);
        geocodedLocations.push(geocoded);
      } else {
        // Return as-is for VirtualLocation or already geocoded
        geocodedLocations.push(location);
      }
    }

    return geocodedLocations;
  }

  /**
   * Wait for rate limit (1 request per second)
   * Ensures we don't exceed Photon API rate limits
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

/**
 * Result from geocoding service
 */
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  enrichedAddress: {
    streetAddress?: string;
    housenumber?: string;
    postalCode?: string;
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string;
    countryCode?: string;
    district?: string;
  };
  osmData?: {
    osmType?: string;
    osmId?: number;
    osmKey?: string;
    osmValue?: string;
    type?: string;
    extent?: number[];
  };
}
