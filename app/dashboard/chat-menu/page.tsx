import { ChatMenuPanel } from "@/components/forms/chat-menu-panel";
import { requireUser } from "@/server/auth/session";

export default async function DashboardChatMenuPage() {
  await requireUser("/login");

  return <ChatMenuPanel />;
}
