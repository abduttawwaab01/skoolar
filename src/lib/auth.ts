import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { checkRateLimit } from './rate-limiter';
import { checkSubscriptionExpiry } from './auth-middleware';

// Distributed rate limiting for login attempts
async function checkLoginRate(ip: string): Promise<{ allowed: boolean; message?: string }> {
  const result = await checkRateLimit(`login:${ip}`, 5, 60 * 1000);
  if (!result.allowed) {
    return { allowed: false, message: 'Too many login attempts. Please try again in a minute.' };
  }
  return { allowed: true };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
        credentials: {
          email: { label: 'Email', type: 'email', placeholder: process.env.SUPER_ADMIN_EMAIL || 'admin@skoolar.com' },
          password: { label: 'Password', type: 'password' },
          role: { label: 'Role', type: 'text' },
          schoolId: { label: 'School ID', type: 'text' },
        },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Rate limiting for login attempts
        const ip = (req as Request & { ip?: string }).ip || 'unknown';
        const rateCheck = await checkLoginRate(ip);
        if (!rateCheck.allowed) {
          throw new Error(rateCheck.message || 'Too many login attempts. Please try again in a minute.');
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { school: true },
        });

        if (!user || !user.password) {
          return null;
        }

        if (!user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        // For non-SUPER_ADMIN users, verify they belong to the selected school
        if (user.role !== 'SUPER_ADMIN' && credentials.schoolId) {
          if (user.schoolId !== credentials.schoolId) {
            if (!user.schoolId) {
              return null;
            }
            return null;
          }
        }

        if (user.role !== 'SUPER_ADMIN' && !user.schoolId) {
          return null;
        }

        // Check subscription expiry
        if (user.role !== 'SUPER_ADMIN' && user.schoolId) {
          const expiry = await checkSubscriptionExpiry(user.schoolId, user.role);
          if (expiry.blocked) {
            throw new Error('Your school subscription has expired. Please contact your school administrator to renew.');
          }
          if (expiry.inGracePeriod && user.role !== 'SCHOOL_ADMIN') {
            // Non-admin users in grace period get a warning but can still log in
          }
        }

        // Update last login asynchronously (don't block auth response)
        // Only update once per day to reduce DB writes
        const shouldUpdateLogin = !user.lastLogin || 
          (Date.now() - user.lastLogin.getTime() > 24 * 60 * 60 * 1000);
        
        if (shouldUpdateLogin) {
          db.user.update({
            where: { id: user.id },
            data: {
              lastLogin: new Date(),
              loginCount: { increment: 1 },
            },
          }).catch(() => {}); // Silently ignore errors
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
          schoolName: user.school?.name ?? 'Skoolar Platform',
          avatar: user.avatar,
          planName: user.school?.plan ?? 'free',
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 90 * 24 * 60 * 60, // 90 days (reduced re-authentication frequency)
    updateAge: 24 * 60 * 60,   // Refresh token every 24 hours
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role.toUpperCase();
        token.schoolId = user.schoolId;
        token.schoolName = user.schoolName;
        token.avatar = user.avatar;
        token.planName = user.planName;
      }
      // Check subscription expiry on each JWT refresh
      if (token.schoolId && token.role !== 'SUPER_ADMIN') {
        const expiry = await checkSubscriptionExpiry(token.schoolId, token.role);
        token.subscriptionExpired = expiry.expired || false;
        token.adminForcedToPayment = expiry.adminForcedToPayment || false;
        token.daysRemaining = expiry.daysRemaining ?? undefined;
        token.warningDays = expiry.warningDays ?? undefined;
        // Fetch latest tokenVersion from school
        const school = await db.school.findUnique({ where: { id: token.schoolId }, select: { tokenVersion: true } });
        token.tokenVersion = school?.tokenVersion ?? 0;
      } else {
        token.subscriptionExpired = false;
        token.adminForcedToPayment = false;
        token.daysRemaining = undefined;
        token.warningDays = undefined;
        token.tokenVersion = 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.schoolId = token.schoolId as string | null;
        session.user.schoolName = token.schoolName as string;
        session.user.avatar = token.avatar as string | null;
        session.user.planName = token.planName as string;
        // Real-time subscription check from DB (runs on every session read)
        if (token.schoolId && token.role !== 'SUPER_ADMIN') {
          const expiry = await checkSubscriptionExpiry(token.schoolId, token.role);
          session.user.subscriptionExpired = expiry.expired || false;
          session.user.adminForcedToPayment = expiry.adminForcedToPayment || false;
          session.user.daysRemaining = expiry.daysRemaining ?? undefined;
          session.user.warningDays = expiry.warningDays ?? undefined;
          const school = await db.school.findUnique({ where: { id: token.schoolId }, select: { tokenVersion: true } });
          session.user.tokenVersion = school?.tokenVersion ?? 0;
        } else {
          session.user.subscriptionExpired = false;
          session.user.adminForcedToPayment = false;
          session.user.daysRemaining = undefined;
          session.user.warningDays = undefined;
          session.user.tokenVersion = 0;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Extend the Next.js session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      schoolId: string | null;
      schoolName: string;
      avatar: string | null;
      planName: string;
      subscriptionExpired?: boolean;
      adminForcedToPayment?: boolean;
      daysRemaining?: number;
      warningDays?: number;
      tokenVersion?: number;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    schoolId: string | null;
    schoolName: string;
    avatar: string | null;
    planName: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    schoolId: string | null;
    schoolName: string;
    avatar: string | null;
    planName: string;
    subscriptionExpired?: boolean;
    adminForcedToPayment?: boolean;
    daysRemaining?: number;
    warningDays?: number;
    tokenVersion?: number;
  }
}
