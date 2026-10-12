import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from './firebase';

const AuthContext = createContext<{ user: User | null; loading: boolean; signIn: () => Promise<void>; logout: () => Promise<void> }>({ user: null, loading: true, signIn: async () => {}, logout: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return <AuthContext.Provider value={{ user, loading, signIn, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
