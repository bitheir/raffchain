/**
 * Extracts the revert message from contract errors
 * @param {Error} error - The error object from contract calls
 * @returns {string} - The extracted revert message or a fallback message
 */
export const extractRevertMessage = (error) => {
  if (!error) return 'Transaction failed';
  
  // Debug logging to see error structure
  console.log('Error object:', error);
  console.log('Error message:', error.message);
  console.log('Error data:', error.data);
  console.log('Error reason:', error.reason);
  console.log('Error code:', error.code);
  console.log('Error toString:', error.toString());
  
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
    // Newer ethers.js error format: "VM Exception while processing transaction: reverted with reason string 'Raffle is not in pending state'"
    /reverted with reason string '([^']+)'/i,
    // Another ethers.js format: "VM Exception while processing transaction: reverted with custom error"
    /reverted with custom error/i,
    // Error messages in square brackets
    /\[([^\]]+)\]/,
    // Another common format: "Transaction reverted: Raffle is not in pending state"
    /Transaction reverted: (.+)/i,
    // VM Exception format: "VM Exception while processing transaction: reverted with reason string 'Raffle is not in pending state'"
    /VM Exception while processing transaction: reverted with reason string '([^']+)'/i,
    // Another VM Exception format: "VM Exception while processing transaction: reverted"
    /VM Exception while processing transaction: reverted/i,
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
  
  // Try to extract from error.reason (newer ethers.js format)
  if (error.reason) {
    return error.reason;
  }
  
  // Try to extract from error.error if it exists
  if (error.error && error.error.message) {
    const nestedError = extractRevertMessage(error.error);
    if (nestedError !== 'Transaction failed') {
      return nestedError;
    }
  }
  
  // Try to extract from error.transaction if it exists (ethers.js v6 format)
  if (error.transaction && error.transaction.data) {
    try {
      // This might contain the revert reason
      console.log('Error transaction data:', error.transaction.data);
    } catch (e) {
      // Ignore
    }
  }
  
  // Try to extract from error.receipt if it exists
  if (error.receipt && error.receipt.logs) {
    try {
      console.log('Error receipt logs:', error.receipt.logs);
    } catch (e) {
      // Ignore
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