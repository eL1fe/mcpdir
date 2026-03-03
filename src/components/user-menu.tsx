"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link href="/auth/signin">
          <LogIn className="h-4 w-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-2"
        >
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User"}
              width={24}
              height={24}
              className="rounded-full"
            />
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="hidden sm:inline text-sm">
            {session.user.githubUsername}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass border-[var(--glass-border)]">
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Signed in as @{session.user.githubUsername}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/u/${session.user.githubUsername}`}>
            <User className="h-4 w-4 mr-2" />
            My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="text-red-400 focus:text-red-400 cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
