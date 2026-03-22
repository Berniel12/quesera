import { NextResponse } from "next/server";
import { getInferredLocation } from "@/lib/geo";

/** Lightweight endpoint returning inferred country/region from request headers */
export async function GET(request: Request) {
  const inferred = getInferredLocation(new Headers(request.headers));

  return NextResponse.json({
    country: inferred.country,
    region: inferred.region,
  });
}
