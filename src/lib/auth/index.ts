import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as unknown as {
          id: number;
          login: string;
          email?: string;
          avatar_url?: string;
        };

        // Upsert user in database
        const existing = await db.query.users.findFirst({
          where: eq(users.githubId, githubProfile.id),
        });

        if (existing) {
          await db
            .update(users)
            .set({
              githubUsername: githubProfile.login,
              email: githubProfile.email ?? existing.email,
              avatarUrl: githubProfile.avatar_url ?? existing.avatarUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existing.id));
        } else {
          await db.insert(users).values({
            githubId: githubProfile.id,
            githubUsername: githubProfile.login,
            email: githubProfile.email ?? null,
            avatarUrl: githubProfile.avatar_url ?? null,
          });
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as unknown as { id: number; login: string };
        token.githubId = githubProfile.id;
        token.githubUsername = githubProfile.login;

        // Get user from database to include our user ID and admin status
        const dbUser = await db.query.users.findFirst({
          where: eq(users.githubId, githubProfile.id),
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.isAdmin = dbUser.isAdmin === 1;
        }
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.userId as string,
          githubId: token.githubId as number,
          githubUsername: token.githubUsername as string,
          isAdmin: token.isAdmin as boolean,
        },
      };
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
