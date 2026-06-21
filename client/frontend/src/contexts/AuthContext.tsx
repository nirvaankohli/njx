import React, { createContext, useContext, useEffect, useState } from "react";
import { frontendApi, type FrontendProfile, type FrontendUser } from "@/lib/frontend-api";

type Session = {
  user: FrontendUser;
  profile: FrontendProfile;
  company_name?: string | null;
};

interface AuthContextType {
  user: FrontendUser;
  session: Session | null;
  profile: FrontendProfile;
  loading: boolean;
  demoSignIn: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FrontendUser>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<FrontendProfile>(null);
  const [loading, setLoading] = useState(true);

  const syncSession = (nextSession: Awaited<ReturnType<typeof frontendApi.session>> | null) => {
    if (!nextSession || !nextSession.user) {
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    const next = {
      user: nextSession.user,
      profile: nextSession.profile,
      company_name: nextSession.company_settings?.company_name ?? null,
    };
    setSession(next);
    setUser(nextSession.user);
    setProfile(nextSession.profile);
  };

  useEffect(() => {
    frontendApi
      .session()
      .then((current) => syncSession(current))
      .catch(() => {
        setSession(null);
        setUser(null);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const next = await frontendApi.signUp({ email, password, full_name: fullName });
    syncSession(next);
  };

  const demoSignIn = async () => {
    const next = await frontendApi.demoSignIn();
    syncSession(next);
  };

  const signIn = async (email: string, password: string) => {
    const next = await frontendApi.signIn({ email, password });
    syncSession(next);
  };

  const signOut = async () => {
    await frontendApi.signOut();
    syncSession(null);
  };

  const refreshProfile = async () => {
    const current = await frontendApi.session();
    syncSession(current);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, demoSignIn, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
