import { NextResponse, type NextRequest } from "next/server"

// This endpoint has been removed. Resetting cards is no longer supported;
// use the monthly archive flow instead.
export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "Endpoint removed. Use /api/admin/archive instead." }, { status: 410 })
}
