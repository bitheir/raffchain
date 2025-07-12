import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { SUPPORTED_NETWORKS } from '../../networks';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { toast } from 'sonner';

// Safely extract a string from any error
const getErrorMessage = (err) => {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string') return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const NetworkSelector = () => {
  const { chainId, switchNetwork, addNetwork, isSupportedNetwork } = useWallet();
  const [pending, setPending] = React.useState(false);

  const handleChange = async (value) => {
    const targetChainId = parseInt(value, 10);
    setPending(true);
    try {
      await switchNetwork(targetChainId);
    } catch (err) {
      const errMsg = getErrorMessage(err).toLowerCase();
      // Rabby/MetaMask: Unrecognized chain ID or not added
      if (
        (err && err.code === 4902) ||
        errMsg.includes('add this network') ||
        errMsg.includes('unrecognized chain id') ||
        (err && err.code === -32603)
      ) {
        try {
          await addNetwork(targetChainId);
          // Try switching again after adding
          setTimeout(async () => {
            try {
              await switchNetwork(targetChainId);
            } catch (switchErr) {
              setTimeout(() => {
                if (window.ethereum && window.ethereum.chainId) {
                  const currentChainId = parseInt(window.ethereum.chainId, 16);
                  if (currentChainId !== targetChainId) {
                    toast.error('Failed to switch to the new network after adding: ' + getErrorMessage(switchErr));
                  }
                }
              }, 1000);
            }
          }, 500);
        } catch (addErr) {
          setTimeout(() => {
            if (window.ethereum && window.ethereum.chainId) {
              const currentChainId = parseInt(window.ethereum.chainId, 16);
              if (currentChainId !== targetChainId) {
                toast.error('Failed to add network: ' + getErrorMessage(addErr));
              }
            }
          }, 1000);
        }
      } else {
        setTimeout(() => {
          if (window.ethereum && window.ethereum.chainId) {
            const currentChainId = parseInt(window.ethereum.chainId, 16);
            if (currentChainId !== targetChainId) {
              toast.error('Failed to switch network: ' + getErrorMessage(err));
            }
          }
        }, 1000);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={chainId ? String(chainId) : ''} onValueChange={handleChange} disabled={pending}>
        <SelectTrigger className="min-w-[180px]">
          <SelectValue placeholder="Select Network" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SUPPORTED_NETWORKS).map(([id, net]) => (
            <SelectItem key={id} value={id}>
              {net.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Only show warning if wallet is connected and network is unsupported */}
      {chainId && !isSupportedNetwork && (
        <span className="text-xs text-red-500 ml-2">Unsupported Network</span>
      )}
    </div>
  );
};

export default NetworkSelector; 