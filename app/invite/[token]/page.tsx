import InviteAcceptScreen from "@/components/InviteAcceptScreen";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteAcceptScreen token={token} />;
}
