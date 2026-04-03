import { redirect } from "next/navigation";

import { getBuilderToken } from "@/app/contracts/actions";
import { DocusealBuilderPage } from "@/app/contracts/_components/docuseal-builder-page";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const result = await getBuilderToken({ name: "Untitled Template" });

  if (result.error || !result.token) {
    redirect("/contracts");
  }

  return (
    <DocusealBuilderPage
      token={result.token}
      defaultName=""
      agreementType="estate_sale"
    />
  );
}
