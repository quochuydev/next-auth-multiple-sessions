import SignOut from "@/ui/SignOut";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    return_url?: string;
    session_id?: string;
  };
}) {
  return (
    <SignOut
      returnUrl={searchParams.return_url}
      sessionId={searchParams.session_id}
    />
  );
}
