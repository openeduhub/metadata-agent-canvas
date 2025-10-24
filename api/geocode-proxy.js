/**
 * Vercel Serverless Function: Geocoding API Proxy
 * Compatible with Netlify Function API
 * Proxies geocoding requests to Photon API (Komoot)
 * Returns GeoJSON-compatible response format
 * No API key required, but respects usage limits
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Accept both 'q' (Photon-style) and 'address' (legacy)
    const { q, address, lang = 'de', limit = '1' } = req.query;
    const query = q || address;

    if (!query) {
      return res.status(400).json({ 
        error: 'Missing query parameter (q or address)'
      });
    }

    console.log(`[Vercel] Geocoding request for: ${query}`);

    // Call Photon API (Komoot)
    const photonUrl = `https://photon.komoot.io/api/`;
    const params = new URLSearchParams({
      q: query,
      lang: lang,
      limit: limit
    });

    const response = await fetch(`${photonUrl}?${params}`, {
      headers: {
        'User-Agent': 'WLO-Metadata-Canvas/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vercel] Photon API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Geocoding API error',
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();
    
    // Return Photon GeoJSON format (already correct)
    // Frontend expects: { features: [...] }
    if (data && data.features && data.features.length > 0) {
      console.log(`[Vercel] Found ${data.features.length} result(s)`);
      return res.status(200).json(data);
    } else {
      return res.status(200).json({
        type: 'FeatureCollection',
        features: []
      });
    }

  } catch (error) {
    console.error('[Vercel] Function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
