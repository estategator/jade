import { redirect, notFound } from "next/navigation";

import { getBuilderToken, getContractTemplate } from "@/app/contracts/actions";
import { DocusealBuilderPage } from "@/app/contracts/_components/docuseal-builder-page";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  const templateResult = await getContractTemplate(id);
  if (templateResult.error || !templateResult.data) {
    notFound();
  }

  const template = templateResult.data;

  const result = await getBuilderToken({
    docusealTemplateId: template.docuseal_template_id ?? undefined,
    name: template.name,
  });

  if (result.error || !result.token) {
    redirect("/contracts");
  }

  return (
    <DocusealBuilderPage
      token={result.token}
      curatorTemplateId={template.id}
      defaultName={template.name}
      agreementType={template.agreement_type}
    />
  );
}
