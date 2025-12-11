"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Gavel, Info, Lock, Vote, Pickaxe } from "lucide-react";

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
      <div className="flex justify-around items-center max-w-[520px] mx-auto px-2">
        {/* Auctions (Home) */}
        <Link
          href="/"
          className={cn(
            "flex items-center justify-center p-3 transition-colors",
            pathname === "/"
              ? "text-pink-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Gavel className="w-6 h-6" />
        </Link>

        {/* Mine */}
        <Link
          href="/mine"
          className={cn(
            "flex items-center justify-center p-3 transition-colors",
            pathname === "/mine"
              ? "text-pink-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Pickaxe className="w-6 h-6" />
        </Link>

        {/* Stake */}
        <Link
          href="/stake"
          className={cn(
            "flex items-center justify-center p-3 transition-colors",
            pathname === "/stake"
              ? "text-pink-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <div className={cn(
            "w-6 h-6 rounded-full border-[5px]",
            pathname === "/stake"
              ? "border-pink-400"
              : "border-current"
          )} />
        </Link>

        {/* Vote */}
        <Link
          href="/vote"
          className={cn(
            "flex items-center justify-center p-3 transition-colors",
            pathname === "/vote"
              ? "text-pink-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Vote className="w-6 h-6" />
        </Link>

        {/* About */}
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
