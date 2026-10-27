import { AssistantProvider } from "@/components/admin/AssistantContext";
import { AssistantPanel } from "@/components/admin/assistant/AssistantPanel";
import { Shell } from "@/components/admin/Shell";
import { ToastProvider } from "@/components/admin/Toast";
import { listPending } from "@/lib/admin/engine";
import { requireActor } from "@/lib/admin/session";

/** Every signed-in editor screen: the shell, toasts and the assistant. */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const approvals = actor.isOwner ? (await listPending()).length : 0;
  const me = {
    name: actor.name,
    email: actor.email,
    title: actor.title,
    short: actor.short,
    isOwner: actor.isOwner,
    bigText: actor.bigText,
    sections: actor.sections,
  };
  return (
    <ToastProvider>
      <AssistantProvider>
        <Shell me={me} approvals={approvals}>
          {children}
        </Shell>
        <AssistantPanel actor={actor} />
      </AssistantProvider>
    </ToastProvider>
  );
}
