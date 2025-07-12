/**
 * Extracts the revert message from contract errors
 * @param {Error} error - The error object from contract calls
 * @returns {string} - The extracted revert message or a fallback message
 */
export const extractRevertMessage = (error) => {
  if (!error) return 'Transaction failed';
  
  const errorMessage = error.message || error.toString();
  
  // Common patterns for revert messages
  const patterns = [
    // Solidity revert with reason: "execution reverted: Insufficient balance"
    /execution reverted: (.+)/i,
    // Solidity revert without reason: "execution reverted"
    /execution reverted/i,
    // MetaMask error: "MetaMask Tx Signature: User rejected the transaction."
    /User rejected the transaction/i,
    // Gas estimation errors
    /gas required exceeds allowance/i,
    // Network errors
    /network error/i,
    // RPC errors
    /rpc error/i,
    // Custom revert messages in quotes
    /"([^"]+)"/,
    // Revert messages after "reverted"
    /reverted[:\s]+(.+)/i,
    // Error messages in parentheses
    /\(([^)]+)\)/,
  ];
  
  // Try to extract meaningful message from patterns
  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      // If it's a capture group, return the captured content
      if (match[1]) {
        return match[1].trim();
      }
      // If it's a full match, return a user-friendly version
      if (pattern.source.includes('User rejected')) {
        return 'Transaction was cancelled by user';
      }
      if (pattern.source.includes('gas required')) {
        return 'Insufficient gas for transaction';
      }
      if (pattern.source.includes('network error')) {
        return 'Network connection error';
      }
      if (pattern.source.includes('rpc error')) {
        return 'Network connection error';
      }
      if (pattern.source.includes('execution reverted')) {
        return 'Transaction failed - contract reverted';
      }
    }
  }
  
  // If no patterns match, try to extract from error.data
  if (error.data) {
    try {
      // Try to decode error data
      const decodedError = error.data;
      if (decodedError && typeof decodedError === 'string') {
        return decodedError;
      }
    } catch (e) {
      // Ignore decoding errors
    }
  }
  
  // Fallback messages based on error type
  if (errorMessage.includes('insufficient funds')) {
    return 'Insufficient balance for transaction';
  }
  if (errorMessage.includes('nonce')) {
    return 'Transaction nonce error - please refresh and try again';
  }
  if (errorMessage.includes('already known')) {
    return 'Transaction already submitted';
  }
  if (errorMessage.includes('replacement transaction')) {
    return 'Transaction replacement error';
  }
  if (errorMessage.includes('user rejected')) {
    return 'Transaction was cancelled';
  }
  
  // If all else fails, return a generic message
  return 'Transaction failed';
};

/**
 * Formats error messages for display in toasts
 * @param {Error} error - The error object
 * @returns {string} - Formatted error message
 */
export const formatErrorForToast = (error) => {
  const revertMessage = extractRevertMessage(error);
  
  // Capitalize first letter and ensure proper punctuation
  const formatted = revertMessage.charAt(0).toUpperCase() + revertMessage.slice(1);
  
  // Add period if missing
  if (!formatted.endsWith('.') && !formatted.endsWith('!') && !formatted.endsWith('?')) {
    return formatted + '.';
  }
  
  return formatted;
}; 