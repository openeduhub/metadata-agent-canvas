import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

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

  /**
   * Get the appropriate Photon API URL based on environment
   * - Local development: From environment.geocoding.proxyUrl
   * - Netlify production: /.netlify/functions/photon
   */
  private getPhotonUrl(): string {
    if (environment.production) {
      console.log('🗺️ Using Netlify Photon proxy');
      return '/.netlify/functions/photon';
    }
    
    // Development: Use URL from environment config
    const proxyUrl = (environment as any).geocoding?.proxyUrl || 'http://localhost:3001/geocoding';
    console.log(`🗺️ Using geocoding proxy: ${proxyUrl}`);
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
        console.log('⚠️ Geocoding skipped: No address components available');
        return null;
      }

      const query = queryParts.join(', ');
      console.log(`🗺️ Geocoding address: "${query}"`);

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
        console.log(`⚠️ No geocoding results found for: "${query}"`);
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

      console.log(`✅ Geocoded: ${result.latitude}, ${result.longitude}`);
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

    console.log(`🗺️ Geocoding ${locations.length} locations...`);

    // Process sequentially to respect rate limit (not in parallel)
    const geocodedLocations: any[] = [];
    for (const location of locations) {
      // Check if it's a Place with address (not VirtualLocation)
      if (location['@type'] === 'Place' && location.address) {
        const geocoded = await this.geocodePlace(location);
        geocodedLocations.push(geocoded);
      } else {
        // Return as-is for VirtualLocation or PostalAddress
        geocodedLocations.push(location);
      }
    }

    const geocodedCount = geocodedLocations.filter(l => l.geo).length;
    console.log(`✅ Geocoded ${geocodedCount} of ${locations.length} locations`);

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
      console.log(`⏱️ Rate limiting: Waiting ${waitTime}ms before next geocoding request`);
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
