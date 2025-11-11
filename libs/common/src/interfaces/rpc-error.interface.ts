export interface RpcError {
  error?: {
    statusCode?: number;
    message?: string;
    error?: string;
  };
  statusCode?: number;
  message?: string;
}
