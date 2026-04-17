export declare function syncWithServer(): Promise<{
    applied: number;
    error: string;
    errors?: undefined;
} | {
    applied: number;
    error?: undefined;
    errors?: undefined;
} | {
    applied: number;
    errors: string[];
    error?: undefined;
}>;
export default syncWithServer;
