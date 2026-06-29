import { agents } from "@/app/studio/_data/agents";

export const dynamic = "force-static";

export async function GET() {
  return Response.json({ agents });
}
