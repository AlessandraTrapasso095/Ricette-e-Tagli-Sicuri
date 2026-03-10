import { ChatMenuPanel } from "@/components/forms/chat-menu-panel";
import { CHAT_ACCESS_REQUIRED_MESSAGE } from "@/config/chat-access";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getUserChatAccessStatus } from "@/server/chat/chat-access";
import { requireUser } from "@/server/auth/session";

export default async function DashboardChatMenuPage() {
  const user = await requireUser("/login");
  const chatAccess = await getUserChatAccessStatus(user.id);

  if (!chatAccess.hasAccess) {
    return (
      <div className="space-y-4">
        <EmptyState title="Chat non ancora attiva" description={CHAT_ACCESS_REQUIRED_MESSAGE} />
        <Card className="p-4">
          <Link href="/dashboard/libri" className="text-sm font-semibold text-rose-700 hover:text-rose-800">
            Vai a I miei libri per sbloccare l&apos;accesso
          </Link>
        </Card>
      </div>
    );
  }

  return <ChatMenuPanel />;
}
