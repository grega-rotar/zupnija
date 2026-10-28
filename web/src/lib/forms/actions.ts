/**
 * The public forms' editor actions, for src/lib/admin/registry.ts (one import line):
 * intentionRequest.decline, sacramentRequest.resolve and enrolment.setOpen.
 * Converting an intention request is intention.add with `requestId` (lib/mase/actions.ts).
 */
import "server-only";
import "@/lib/mase/requests";
import "@/lib/sacraments/requests";
import "@/lib/verouk/enrolment";
