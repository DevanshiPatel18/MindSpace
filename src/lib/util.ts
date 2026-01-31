export function b64FromBytes(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function bytesFromB64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function uuid(): string {
    if(typeof crypto !== 'undefined' && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID()
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function formatDate(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}