type AuthEventListener = () => void;

class AuthEvents {
    private listeners: AuthEventListener[] = [];

    onUnauthorized(callback: AuthEventListener) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    emitUnauthorized() {
        console.log('AuthEvents: Emitting unauthorized event');
        this.listeners.forEach(callback => callback());
    }
}

export const authEvents = new AuthEvents();
