import { A } from "@solidjs/router";
import { createSignal, onMount, onCleanup } from "solid-js";
import type { ParentProps } from "solid-js";
import JasmineLogo from "./JasmineLogo";
import KeyboardLegend from "./KeyboardLegend";
import { useGlobalShortcuts, focusMain } from "../lib/shortcuts";
import { initSound, isSoundEnabled, toggleSound } from "../lib/sounds";
import type { WhatsNext } from "../lib/types";

export default function Layout(props: ParentProps) {
  useGlobalShortcuts();

  // No in-form tracking needed — nav keys don't fire inside forms.
  // User presses Escape to close the form, then bare key navigates.

  const [soundOn, setSoundOn] = createSignal(true);
  onMount(async () => {
    await initSound();
    setSoundOn(isSoundEnabled());
  });

  const handleToggleSound = async () => {
    const next = await toggleSound();
    setSoundOn(next);
  };

  const [whatsNextToast, setWhatsNextToast] = createSignal<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const onWhatsNext = (e: Event) => {
    const detail = (e as CustomEvent<WhatsNext>).detail;
    if (toastTimer) clearTimeout(toastTimer);
    setWhatsNextToast(detail.kind === "none" ? detail.label : `Next: ${detail.label}`);
    toastTimer = setTimeout(() => setWhatsNextToast(null), 5000);
  };

  onMount(() => window.addEventListener("whats-next", onWhatsNext));
  onCleanup(() => {
    window.removeEventListener("whats-next", onWhatsNext);
    if (toastTimer) clearTimeout(toastTimer);
  });

  const links = [
    { href: "/tasks", label: "Tasks", key: "1", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    { href: "/inventory", label: "Inventory", key: "2", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { href: "/restock", label: "Buy Again", key: "3", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" },
    { href: "/calendar", label: "Calendar", key: "C", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { href: "/", label: "Home", key: "D", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
    { href: "/import", label: "Import", key: "4", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
    { href: "/audit", label: "History", key: "5", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div class="flex h-screen bg-ivory">
      <nav class="w-60 bg-cream flex flex-col border-r border-champagne/60 shadow-sm" aria-label="Main navigation">
        <div class="px-5 pt-5 pb-4 flex items-center gap-3">
          <JasmineLogo size={42} />
          <div>
            <h1 class="text-2xl text-bark italic" style={{ "font-family": "'Playfair Display', serif", "font-weight": "600", "letter-spacing": "0.02em" }}>YASS</h1>
            <p class="text-[10px] text-bark-muted leading-tight tracking-wide">Yass's Assistive Software System</p>
          </div>
        </div>
        <div class="px-3 mb-2">
          <div class="h-px bg-champagne/60" />
        </div>
        <ul class="flex-1 px-3 space-y-0.5">
          {links.map((link) => (
            <li>
              <A
                href={link.href}
                tabIndex={-1}
                class="flex items-center gap-3 px-4 py-3.5 rounded-xl text-bark-muted text-[15px] hover:bg-surface-hover hover:text-bark transition-all focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2"
                activeClass="!bg-jasmine/40 !text-bark font-semibold shadow-sm"
                end={link.href === "/"}
                aria-label={`${link.label} (press ${link.key})`}
                onClick={() => focusMain()}
              >
                <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d={link.icon} />
                </svg>
                <span class="flex-1">{link.label}</span>
                <kbd class="text-xs text-bark-light bg-champagne/50 w-5 h-5 rounded flex items-center justify-center font-mono">{link.key}</kbd>
              </A>
            </li>
          ))}
        </ul>
        <div class="px-3">
          <div class="h-px bg-champagne/60" />
        </div>
        <KeyboardLegend />
        <div class="px-5 py-4 flex items-center justify-center gap-3">
          <button
            onClick={handleToggleSound}
            tabIndex={-1}
            class="flex items-center gap-1.5 text-xs text-bark-light hover:text-bark transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-hover"
            aria-label={soundOn() ? "Mute sounds" : "Enable sounds"}
            title={soundOn() ? "Sounds on — click to mute" : "Sounds off — click to enable"}
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              {soundOn()
                ? <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
                : <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              }
            </svg>
            {soundOn() ? "Sound on" : "Sound off"}
          </button>
        </div>
      </nav>
      <main id="main-content" class="flex-1 overflow-y-auto p-8 outline-none" role="main" tabindex="-1">
        {props.children}
        {whatsNextToast() && (
          <div class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 bg-bark text-ivory rounded-xl shadow-lg text-sm font-medium animate-fade-in z-50">
            <kbd class="font-mono text-jasmine mr-2">W</kbd>
            {whatsNextToast()}
          </div>
        )}
      </main>
    </div>
  );
}
