// The slice of the Deno runtime the Edge Functions use, so `tsc -b`
// (tsconfig.functions.json) can type-check them without the Deno toolchain.
// Supabase's runtime provides the real thing; this file is never deployed.
declare namespace Deno {
  const env: { get(name: string): string | undefined }
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown
}
