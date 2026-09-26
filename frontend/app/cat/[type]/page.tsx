import { redirect } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params; redirect(`https://srnchv.github.io/-zotov-prototype/#/cat/${type}`);
}
