import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Wallet, X, ChevronDown } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { formatErrorForToast } from '../../utils/errorUtils';

const WalletModal = ({ isOpen, onClose }) => {
  const { connectWallet, loading } = useWallet();

  const handleConnect = async (walletType) => {
    try {
      await connectWallet(walletType);
      onClose();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet: ' + formatErrorForToast(error));
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 border rounded-lg w-full max-w-md p-6 mx-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-black dark:text-white">Connect Wallet</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <X className="h-5 w-5 text-black dark:text-white" />
            </button>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => handleConnect('metamask')}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
            >
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-medium text-black dark:text-white">MetaMask</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Connect using browser wallet</div>
              </div>
            </button>
            <button
              onClick={() => handleConnect('walletconnect')}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-medium text-black dark:text-white">WalletConnect</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Scan with mobile wallet</div>
              </div>
            </button>
            <button
              onClick={() => handleConnect('coinbase')}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-medium text-black dark:text-white">Coinbase Wallet</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Connect using Coinbase</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default WalletModal;

