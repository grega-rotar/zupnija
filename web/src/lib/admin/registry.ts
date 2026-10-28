/**
 * Importing this module registers every editor action with the engine.
 * Each feature adds exactly one import line for its actions module.
 */
import "server-only";
import "@/lib/mase/actions";
import "@/lib/dogodki/actions";
import "@/lib/verouk/actions";
import "@/lib/bulletin/actions";
import "@/lib/ljudje/actions";
import "@/lib/content/actions";
import "@/lib/forms/actions";
export * from "./engine";
