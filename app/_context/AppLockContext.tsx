import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type TimeoutOption = 0 | 5000 | 60000 | 300000;

interface AppLockContextType {
    isLocked: boolean;
    appLockPin: string | null;
    timeoutOption: TimeoutOption;
    enablePin: (pin: string) => Promise<void>;
    disablePin: () => Promise<void>;
    verifyPin: (pin: string) => boolean;
    setTimeoutOption: (option: TimeoutOption) => Promise<void>;
    unlockApp: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLocked, setIsLocked] = useState(false);
    const [appLockPin, setAppLockPin] = useState<string | null>(null);
    const [timeoutOption, setTimeoutOptionState] = useState<TimeoutOption>(0);
    const [isAppReady, setIsAppReady] = useState(false);

    const backgroundTimeRef = useRef<number | null>(null);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const initLock = async () => {
            try {
                // Load PIN
                const storedPin = await SecureStore.getItemAsync('app_lock_pin');
                if (storedPin) {
                    setAppLockPin(storedPin);
                    // On cold start, if PIN exists, lock it immediately
                    setIsLocked(true);
                }

                // Load preference
                const storedTimeout = await AsyncStorage.getItem('app_lock_timeout');
                if (storedTimeout) {
                    setTimeoutOptionState(parseInt(storedTimeout, 10) as TimeoutOption);
                }
            } catch (e) {
                console.error("Error initializing AppLock", e);
            } finally {
                setIsAppReady(true);
            }
        };

        initLock();

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, []);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (!appLockPin) return; // Feature disabled

        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            // App has come to the foreground
            if (backgroundTimeRef.current !== null) {
                const timeAway = Date.now() - backgroundTimeRef.current;
                if (timeAway >= timeoutOption) {
                    setIsLocked(true);
                }
            } else {
                // Fallback: If no background time was recorded but we came to active, lock it.
                setIsLocked(true);
            }
        } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
            // App has gone to the background
            backgroundTimeRef.current = Date.now();
        }

        appState.current = nextAppState;
    };

    const enablePin = async (pin: string) => {
        await SecureStore.setItemAsync('app_lock_pin', pin);
        setAppLockPin(pin);
    };

    const disablePin = async () => {
        await SecureStore.deleteItemAsync('app_lock_pin');
        setAppLockPin(null);
        setIsLocked(false);
    };

    const setTimeoutOption = async (option: TimeoutOption) => {
        await AsyncStorage.setItem('app_lock_timeout', option.toString());
        setTimeoutOptionState(option);
    };

    const verifyPin = (pin: string): boolean => {
        return pin === appLockPin;
    };

    const unlockApp = () => {
        setIsLocked(false);
    };

    return (
        <AppLockContext.Provider
            value={{
                isLocked,
                appLockPin,
                timeoutOption,
                enablePin,
                disablePin,
                verifyPin,
                setTimeoutOption,
                unlockApp,
            }}
        >
            {/* If app is ready but somehow locked and we haven't rendered children yet... 
            Wait, _layout.tsx will handle rendering the AppLockScreen. We just expose the value. */}
            {isAppReady ? children : null}
        </AppLockContext.Provider>
    );
};

export const useAppLock = () => {
    const context = useContext(AppLockContext);
    if (context === undefined) {
        throw new Error('useAppLock must be used within an AppLockProvider');
    }
    return context;
};
