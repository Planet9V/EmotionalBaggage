import { NextResponse } from "next/server";
import { body, route } from "@/lib/api/route";
import { checkCredentialFields, providerView, saveCredentials } from "@/lib/admin/credentials";
import { credentialsPut } from "@/lib/admin/schemas";

type Ctx = { params: Promise<{ provider: string }> };

/** { fields: { name: value } }. Absent or empty fields are left as they are; values are trimmed. */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const { provider } = await params;
  const b = await body(req, credentialsPut);
  const { def, values } = checkCredentialFields(provider, b.fields);
  await saveCredentials(def, values);
  return NextResponse.json({ provider: await providerView(def.id) });
});
