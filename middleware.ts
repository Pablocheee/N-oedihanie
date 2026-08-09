export const config = {
  // Intercept HTML requests but ignore static assets, API routes, and media files
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)).*)',
  ],
};

const CLIENT_ID = 'Z85DKUeIp2GwtDFtc7iM';
const SAAS_API_URL = 'https://ordoaxio.vercel.app/api/get-kv';

export default async function middleware(request: Request) {
  // 1. Fetch original response
  const response = await fetch(request);

  // We only want to inject JSON-LD into HTML documents
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  try {
    // 2. Perform fetch to our SaaS API using an AbortController with a strict 300ms timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300);

    const apiResponse = await fetch(`${SAAS_API_URL}?clientId=${CLIENT_ID}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      throw new Error(`SaaS API returned status ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    const jsonLdData = data.jsonLd || data?.features?.jsonLd;

    // 3. If the SaaS API returned valid JSON-LD data
    if (jsonLdData) {
      // Clone the original response and read it as text
      const htmlText = await response.clone().text();
      
      // 4. Inject the semantic <script type="application/ld+json">...</script> tag right before the </head> tag
      const scriptTag = `<script type="application/ld+json">\n${JSON.stringify(jsonLdData)}\n</script>`;
      const modifiedHtml = htmlText.replace('</head>', `${scriptTag}\n</head>`);

      // Return a new Response with the modified HTML
      const newResponse = new Response(modifiedHtml, {
        status: response.status,
        statusText: response.statusText,
      });

      // Forward headers from the original response
      response.headers.forEach((value, key) => {
        newResponse.headers.set(key, value);
      });

      // Remove headers that are no longer accurate due to content modification
      newResponse.headers.delete('content-encoding');
      newResponse.headers.delete('content-length');

      return newResponse;
    }

    return response;
  } catch (error) {
    // 5. Fallback Protection: If the API times out, fails, or takes longer than 300ms, 
    // swallow the error, log it, and instantly return the unmodified original response
    console.error('Edge Middleware fetch failed or timed out. Bypassing:', error);
    return response;
  }
}
