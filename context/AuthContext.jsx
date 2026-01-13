"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Storage } from '@/lib/storage';
import { SyncManager, onSyncStatusChange } from '@/lib/syncManager';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [jiitStatus, setJiitStatus] = useState('unknown'); // 'online' | 'offline' | 'syncing' | 'unknown'
    const [firebaseStatus, setFirebaseStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'failed'
    const [jiitCredentials, setJiitCredentials] = useState(null);

    // Subscribe to sync status changes
    useEffect(() => {
        const unsubscribe = onSyncStatusChange((status) => {
            setJiitStatus(status.jiit);
            setFirebaseStatus(status.firebase);
        });
        return unsubscribe;
    }, []);

    // Listen to Firebase auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Load JIIT credentials from Firestore
                await loadJiitCredentials(firebaseUser.uid);
            } else {
                setUser(null);
                setJiitCredentials(null);
                setJiitStatus('unknown');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load JIIT credentials from Firestore
    const loadJiitCredentials = async (uid) => {
        try {
            const docRef = doc(db, 'users', uid, 'profile', 'jiit');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const creds = {
                    enrollment: data.enrollment,
                    password: data.password
                };
                setJiitCredentials(creds);
                // Also save to localStorage for offline access
                Storage.saveCredentials(data.enrollment, data.password, true);
            }
        } catch (err) {
            console.warn('Failed to load JIIT credentials:', err);
        }
    };

    // Save JIIT credentials to Firestore
    const saveJiitCredentials = async (enrollment, password) => {
        if (!user) return;

        try {
            const docRef = doc(db, 'users', user.uid, 'profile', 'jiit');
            await setDoc(docRef, {
                enrollment,
                password,
                updatedAt: new Date().toISOString()
            });

            const creds = { enrollment, password };
            setJiitCredentials(creds);
            Storage.saveCredentials(enrollment, password, true);
        } catch (err) {
            console.error('Failed to save JIIT credentials:', err);
            throw err;
        }
    };

    // Trigger JIIT sync using SyncManager
    const silentSync = useCallback(async () => {
        const creds = jiitCredentials || Storage.getCredentials();
        return await SyncManager.triggerJiitSync(creds, user?.uid);
    }, [jiitCredentials, user]);

    // Trigger Firebase timetable sync
    const syncTimetable = useCallback(async () => {
        if (!user) return {};
        return await SyncManager.checkTimetableSync(user.uid);
    }, [user]);

    // Save timetable (to localStorage + Firebase)
    const saveTimetable = useCallback(async (timetable) => {
        await SyncManager.saveTimetable(timetable, user?.uid);
    }, [user]);

    // Sign in with Firebase
    const signIn = async (email, password) => {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    };

    // Sign up with Firebase
    const signUp = async (email, password) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        return result.user;
    };

    // Sign out
    const signOutUser = async () => {
        await firebaseSignOut(auth);
        Storage.clearAll();
        setUser(null);
        setJiitCredentials(null);
        setJiitStatus('unknown');
    };

    const value = {
        user,
        loading,
        jiitStatus,
        firebaseStatus,
        jiitCredentials,
        signIn,
        signUp,
        signOut: signOutUser,
        saveJiitCredentials,
        silentSync,
        syncTimetable,
        saveTimetable
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
