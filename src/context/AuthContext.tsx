import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { auth, onAuthStateChanged, signInWithGoogle, signOutUser } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdminMode: boolean;
  setIsAdminMode: (admin: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  managerProfile: {
    name: string;
    role: string;
    photoURL: string;
  };
}

const DEFAULT_MANAGER_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSQrnolhm0Epk2PGVh0OmbZjqT90RQwH-NygAUG2gaFF_4Bn58_VihZV_jdMWE_LyQpvf3NvMeh8y412_0PDdTJrKZqYnqQO40pPgCk_ZhtjgS7irAduDIqkiXPaMlOHdEszFNIuuIF9d9z9jadZwHqe7qNVzfupQARmnZDTi2iYoUNXP71KF6vQKEqlYYAj58-322zFpGtCTf2nBa1Vc9Iju5V_cGpsHcXgftihn3gRCXObTf1yI';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('atelier_admin_mode');
    return saved !== null ? saved === 'true' : true; // Default to admin for complete store control
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSetIsAdminMode = (val: boolean) => {
    setIsAdminMode(val);
    localStorage.setItem('atelier_admin_mode', String(val));
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithGoogle();
      setIsAdminMode(true);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const managerProfile = {
    name: user?.displayName || 'Camila Valenzuela',
    role: user ? 'Dueño / Administrador' : 'Administrador',
    photoURL: user?.photoURL || DEFAULT_MANAGER_AVATAR
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdminMode,
        setIsAdminMode: handleSetIsAdminMode,
        loginWithGoogle,
        logout,
        managerProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
