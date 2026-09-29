"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

/**
 * Globe + current language, opening a menu that names every language in
 * itself ("Bahasa Melayu", "简体中文") — someone who can't read the page's
 * current language can still find their own. WAI-ARIA menu-button pattern
 * with menuitemradio items: arrows/Home/End move, Enter/Space choose,
 * Escape and Tab close, focus returns to the button.
 */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const current = LANGUAGES.find((option) => option.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    itemRefs.current[LANGUAGES.findIndex((option) => option.code === lang)]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // Focus the checked item on open only, not on every language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current;
    const index = items.findIndex((item) => item === document.activeElement);
    const focusAt = (next: number) => items[(next + items.length) % items.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t.header.language}: ${current.native}`}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
          open
            ? "border-amber/60 text-amber"
            : "border-paper/15 text-paper/85 hover:border-paper/35 hover:text-paper"
        }`}
      >
        <Globe aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{current.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3 w-3 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t.header.language}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-lg border border-paper/15 bg-pit-carbon/95 p-1 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur"
        >
          {LANGUAGES.map((option, index) => {
            const checked = option.code === lang;
            return (
              <button
                key={option.code}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                lang={option.code}
                tabIndex={-1}
                onClick={() => {
                  setLang(option.code);
                  close(true);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:bg-paper/10 ${
                  checked ? "text-amber" : "text-paper hover:bg-paper/5"
                }`}
              >
                <span className="w-7 shrink-0 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                  {option.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-tight">{option.native}</span>
                  {option.native !== option.english ? (
                    <span lang="en" className="block text-[11px] leading-tight text-paper-dim">
                      {option.english}
                    </span>
                  ) : null}
                </span>
                {checked ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
          {t.header.machineTranslated ? (
            <p className="mt-1 border-t border-paper/10 px-2.5 pb-1.5 pt-2 text-[10px] leading-snug text-paper-dim">
              {t.header.machineTranslated}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
