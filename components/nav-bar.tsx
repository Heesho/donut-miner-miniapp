"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Flame, Info } from "lucide-react";

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-zinc-800"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingTop: "8px",
      }}
    >
      <div className="flex justify-around items-center max-w-[520px] mx-auto px-4">
        <Link
          href="/blazery"
          className={cn(
            "flex items-center justify-center p-3 transition-colors",
            pathname === "/blazery"
              ? "text-pink-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Flame className="w-6 h-6" />
        </Link>

        <Link
          href="/"
          className={cn(
            "flex items-center justify-center p-3 transition-colors",
            pathname === "/"
              ? "text-pink-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <div
            className={cn(
              "w-7 h-7 rounded-full border-[5px]",
              pathname === "/" ? "border-pink-400" : "border-gray-400"
            )}
          />
        </Link>

        <Link
          href="/about"
          className={cn(
            "flex items-center justify-center p-3 transition-colors",
            pathname === "/about"
              ? "text-pink-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Info className="w-6 h-6" />
        </Link>
      </div>
    </nav>
  );
}
