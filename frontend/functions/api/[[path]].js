// Cloudflare Pages Function: proxy all /api/* requests to the backend Worker
// via a Service Binding (configure binding name "BACKEND" in Pages dashboard:
// Settings → Functions → Service bindings → add BACKEND → threadweaver-backend)
export async function onRequest(context) {
  return context.env.BACKEND.fetch(context.request);
}
