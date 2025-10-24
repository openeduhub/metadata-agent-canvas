/**
 * Netlify Function: Photon Geocoding Proxy
 * Proxies requests to Photon API to avoid client-side blockers
 * and provide better rate limiting & caching
 */
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Parse query parameters
    const url = new URL(event.rawUrl);
    const q = url.searchParams.get('q');
    const lang = url.searchParams.get('lang') || 'de';
    const limit = url.searchParams.get('limit') || '5';

    // Validate required parameter
    if (!q) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: "Parameter 'q' ist erforderlich." 
        })
      };
    }

    console.log(`🗺️ Photon proxy: Geocoding "${q}"`);

    // Build upstream URL
    const upstream = new URL('https://photon.komoot.io/api/');
    upstream.searchParams.set('q', q);
    upstream.searchParams.set('lang', lang);
    upstream.searchParams.set('limit', limit);

    // Call Photon API with proper User-Agent
    const resp = await fetch(upstream.toString(), {
      headers: {
        'User-Agent': 'metadata-agent-webcomponent/1.0 (Netlify proxy)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    // Get response body
    const body = await resp.text();

    console.log(`✅ Photon proxy: Status ${resp.status}`);

    return {
      statusCode: resp.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        // Cache for 10 minutes (addresses don't change often)
        'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600',
        'X-Proxy-Version': '1.0'
      },
      body
    };

  } catch (err) {
    console.error('❌ Photon proxy error:', err);
    
    return {
      statusCode: 502,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Geocoding service unavailable',
        details: String(err)
      })
    };
  }
};
