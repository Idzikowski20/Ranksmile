import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth0 v3 nie wymaga middleware — ten plik jest pass-through.
// Można go usunąć jeśli nie potrzebujesz żadnej innej logiki middleware.
export function middleware(request: NextRequest) {
   return NextResponse.next();
}
