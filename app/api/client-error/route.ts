export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.error('CLIENT_HYDRATION_ERROR', JSON.stringify(body));
  } catch {
    console.error('CLIENT_HYDRATION_ERROR', 'Unable to parse report');
  }
  return new Response(null, { status: 204 });
}
