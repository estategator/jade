import { redirect } from "next/navigation";

export default function TutorialsPage() {
  redirect("/help?tab=tutorials");
}
