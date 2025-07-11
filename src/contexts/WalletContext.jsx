import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../networks';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);

  // Check if wallet is already connected on page load
  useEffect(() => {
    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  useEffect(() => {
    if (chainId && SUPPORTED_NETWORKS[chainId]) {
      setNetworkInfo(SUPPORTED_NETWORKS[chainId]);
    } else {
      setNetworkInfo(null);
    }
  }, [chainId]);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet('metamask');
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      setAddress(accounts[0]);
    }
  };

  const handleChainChanged = (chainId) => {
    setChainId(parseInt(chainId, 16));
    // Reload the page to reset the dapp state
    window.location.reload();
  };

  const connectWallet = async (walletType) => {
    setLoading(true);
    try {
      let provider;
      
      switch (walletType) {
        case 'metamask':
          if (!window.ethereum) {
            throw new Error('MetaMask is not installed');
          }
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          provider = new ethers.providers.Web3Provider(window.ethereum);
          break;
          
        case 'walletconnect':
          // WalletConnect implementation would go here
          throw new Error('WalletConnect not implemented yet');
          
        case 'coinbase':
          // Coinbase Wallet implementation would go here
          throw new Error('Coinbase Wallet not implemented yet');
          
        default:
          throw new Error('Unsupported wallet type');
      }

      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setAddress(address);
      setChainId(network.chainId);
      setConnected(true);

      // Store connection preference
      localStorage.setItem('walletConnected', walletType);
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setProvider(null);
    setSigner(null);
    setAddress('');
    setConnected(false);
    setChainId(null);
    localStorage.removeItem('walletConnected');
  };

  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (error) {
      // This error code indicates that the chain has not been added to MetaMask
      if (error.code === 4902) {
        throw new Error('Please add this network to your wallet first');
      }
      throw error;
    }
  };

  const isSupportedNetwork = chainId && SUPPORTED_NETWORKS[chainId];

  const addNetwork = async (targetChainId) => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }
    const net = SUPPORTED_NETWORKS[targetChainId];
    if (!net) throw new Error('Network config not found');
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${targetChainId.toString(16)}`,
          chainName: net.name,
          rpcUrls: [net.rpcUrl],
          blockExplorerUrls: [net.explorer],
          nativeCurrency: net.nativeCurrency || { name: 'ETH', symbol: 'ETH', decimals: 18 },
        }],
      });
    } catch (error) {
      throw error;
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const value = {
    provider,
    signer,
    address,
    connected,
    chainId,
    loading,
    connectWallet,
    disconnect,
    switchNetwork,
    addNetwork,
    formatAddress,
    networkInfo,
    isSupportedNetwork,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

