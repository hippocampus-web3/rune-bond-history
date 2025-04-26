export function nanoToMilliseconds(nanoseconds: number): number {
    return Math.floor(nanoseconds / 1_000_000);
}

export function nanoToDate(nanoseconds: number): Date {
    return new Date(nanoToMilliseconds(nanoseconds));
}

export function baseAmountToRune(baseAmount: number): number {
    return baseAmount / 100_000_000;
} 